import type {
  Ambiguity,
  DataAgentOutput,
  ProposedAction,
} from "@/agents/data-agent";
import type { RiskSignalAssessment } from "@/agents/risk-signal-agent";
import type { Channel } from "@/core/channel/types";
import { evaluateMovementRisk } from "@/core/risk";
import type { MovementInput } from "@/shared/schemas/money";
import type { CategoryId, MovementType, RiskLevel } from "@/shared/types/domain";

const DIRECT_MOVEMENT_TYPES = new Set<MovementType>(["gasto", "ingreso"]);
const ACCOUNT_NULL_ALLOWED_REASONS = new Set([
  "account_origin_null_allowed",
  "account_destination_null_allowed",
]);
const READ_ONLY_AMBIGUITY_FIELDS = new Set([
  "conversation_query",
  "financial_summary",
  "read_only_query",
  "weekly_summary",
]);

export type DataActionAccountContext = {
  id: string;
  is_default: boolean;
  name?: string;
  currency?: "PEN" | "USD";
};

export type DataActionCategoryContext = {
  id: CategoryId;
  is_sensitive: boolean;
};

export type DataActionDebtContext = {
  id: string;
  name: string;
  direction: "i_owe" | "they_owe_me";
  status: "active" | "due_soon" | "overdue";
  current_balance: number;
  currency: "PEN" | "USD";
  due_date: string | null;
  next_payment_date: string | null;
  related_person_id: string | null;
  related_person_name: string | null;
  related_person_aliases: string[];
  installments: Array<{
    id: string;
    number: number;
    due_date: string;
    expected_amount: number;
    paid_amount: number;
    status: "pending" | "due_soon" | "overdue";
  }>;
};

export type PlannedDebtPaymentInput = {
  debt_id: string;
  debt_name: string;
  amount: number;
  currency: "PEN" | "USD";
  account_id: string | null;
  installment_id: string | null;
  installment_number: number | null;
  paid_at: string;
  note: string | null;
  direction: "i_owe" | "they_owe_me";
  previous_balance: number;
};

export type PlannedDebtCreationInput = {
  direction: "i_owe" | "they_owe_me";
  kind:
    | "personal"
    | "bank_loan"
    | "credit_card"
    | "installment_purchase"
    | "service_or_bill"
    | "other";
  name: string;
  related_person_name: string;
  principal_amount: number;
  currency: "PEN" | "USD";
  opened_at: string;
  first_due_date: string | null;
  installment_count: number | null;
  installment_amount: number | null;
  interest_notes: string | null;
  account_id: string | null;
  movement_type: "prestamo_recibido" | "prestamo_dado";
};

export type DataActionPlanKind =
  "no_action" | "ready_for_core" | "requires_confirmation" | "blocked";

export type PlannedDataActionDecision =
  "ready_for_core" | "requires_confirmation" | "blocked";

export type PlannedDataAction = {
  action_id: string;
  decision: PlannedDataActionDecision;
  risk_level: RiskLevel;
  reasons: string[];
  movement_input: MovementInput | null;
  debt_payment_input?: PlannedDebtPaymentInput | null;
  debt_creation_input?: PlannedDebtCreationInput | null;
};

export type DataActionPlan = {
  kind: DataActionPlanKind;
  reason:
    | "no_proposed_actions"
    | "all_actions_ready"
    | "confirmation_required"
    | "all_actions_blocked";
  actions: PlannedDataAction[];
  ready_count: number;
  requires_confirmation_count: number;
  blocked_count: number;
};

export function planDataAgentFinancialActions(params: {
  dataAgentOutput: DataAgentOutput;
  accounts: DataActionAccountContext[];
  categories: DataActionCategoryContext[];
  debts?: DataActionDebtContext[];
  sourceRef: string;
  receivedAt: string;
  sourceText?: string | null;
  riskAssessments?: RiskSignalAssessment[];
  recentMedianAmount?: number | null;
  confirmedByUser?: boolean;
  channel: Channel;
}): DataActionPlan {
  const actions = params.dataAgentOutput.result.map((action) =>
    planSingleAction(action, params),
  );

  if (actions.length === 0) {
    return {
      kind: "no_action",
      reason: "no_proposed_actions",
      actions,
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 0,
    };
  }

  actions.forEach((action) => {
    const sourceAction = params.dataAgentOutput.result.find(
      (candidate) => candidate.action_id === action.action_id,
    );
    if (!sourceAction) return;

    const blockingAmbiguities = params.dataAgentOutput.ambiguities.filter(
      (ambiguity) => isBlockingAmbiguity(ambiguity, sourceAction),
    );
    const unscopedConfirmation =
      params.dataAgentOutput.requires_confirmation &&
      params.dataAgentOutput.ambiguities.length === 0;
    const outputRequiresConfirmation =
      blockingAmbiguities.length > 0 ||
      unscopedConfirmation;

    if (outputRequiresConfirmation) {
      if (params.confirmedByUser && action.debt_creation_input) {
        action.reasons.push("confirmation_consumed_by_debt_creation_policy");
        return;
      }
      if (action.decision === "ready_for_core") {
        action.decision = action.debt_payment_input
          ? "blocked"
          : "requires_confirmation";
        action.risk_level = maxRiskLevel(action.risk_level, "medium");
        action.reasons.push("agent_output_requires_confirmation");
        action.movement_input = markMovementInputForReview(
          action.movement_input,
          action.reasons,
        );
      }
    }
  });

  return summarizeDataActionPlan(actions);
}

export function summarizeDataActionPlan(
  actions: PlannedDataAction[],
): DataActionPlan {
  const readyCount = actions.filter(
    (action) => action.decision === "ready_for_core",
  ).length;
  const requiresConfirmationCount = actions.filter(
    (action) => action.decision === "requires_confirmation",
  ).length;
  const blockedCount = actions.filter(
    (action) => action.decision === "blocked",
  ).length;

  if (actions.length === 0) {
    return {
      kind: "no_action",
      reason: "no_proposed_actions",
      actions,
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 0,
    };
  }
  if (readyCount === actions.length) {
    return {
      kind: "ready_for_core",
      reason: "all_actions_ready",
      actions,
      ready_count: readyCount,
      requires_confirmation_count: requiresConfirmationCount,
      blocked_count: blockedCount,
    };
  }
  if (requiresConfirmationCount > 0 || readyCount > 0) {
    return {
      kind: "requires_confirmation",
      reason: "confirmation_required",
      actions,
      ready_count: readyCount,
      requires_confirmation_count: requiresConfirmationCount,
      blocked_count: blockedCount,
    };
  }
  return {
    kind: "blocked",
    reason: "all_actions_blocked",
    actions,
    ready_count: readyCount,
    requires_confirmation_count: requiresConfirmationCount,
    blocked_count: blockedCount,
  };
}

function isBlockingAmbiguity(
  ambiguity: Ambiguity,
  action: ProposedAction,
): boolean {
  if (ambiguity.action_id && ambiguity.action_id !== action.action_id) {
    return false;
  }

  if (ambiguity.scope === "conversation_follow_up") return false;
  if (READ_ONLY_AMBIGUITY_FIELDS.has(ambiguity.field)) return false;

  if (
    ambiguity.risk_level === "low" &&
    ((ambiguity.field === "account_origin_id" &&
      action.movement_type === "gasto" &&
      !action.account_origin_id) ||
      (ambiguity.field === "account_destination_id" &&
        action.movement_type === "ingreso" &&
        !action.account_destination_id))
  ) {
    return false;
  }

  return true;
}

function planSingleAction(
  action: ProposedAction,
  params: {
    accounts: DataActionAccountContext[];
    categories: DataActionCategoryContext[];
    debts?: DataActionDebtContext[];
    sourceRef: string;
    receivedAt: string;
    sourceText?: string | null;
    riskAssessments?: RiskSignalAssessment[];
    recentMedianAmount?: number | null;
    confirmedByUser?: boolean;
    channel: Channel;
  },
): PlannedDataAction {
  if (
    action.debt_hint?.operation === "create_debt" ||
    action.movement_type === "prestamo_recibido" ||
    action.movement_type === "prestamo_dado"
  ) {
    return planDebtCreationAction(action, params);
  }

  if (
    action.movement_type === "pago_deuda" ||
    action.movement_type === "devolucion_recibida"
  ) {
    return planDebtPaymentAction(action, params);
  }

  const reasons: string[] = [];

  const directMovement = DIRECT_MOVEMENT_TYPES.has(action.movement_type);
  if (!directMovement) {
    reasons.push("movement_type_requires_specialized_engine");
  }

  if (action.amount === null) reasons.push("missing_amount");
  if (!action.description?.trim()) reasons.push("missing_description");
  if (!action.category_id) reasons.push("missing_category");
  const category = params.categories.find(
    (candidate) => candidate.id === action.category_id,
  );
  const semanticAssessment = params.riskAssessments?.find(
    (assessment) => assessment.action_id === action.action_id,
  );
  const riskDecision = evaluateMovementRisk({
    movementType: action.movement_type,
    amount: action.amount,
    confidence: action.confidence,
    categorySensitive: category?.is_sensitive === true,
    semanticAssessment,
    recentMedianAmount: params.recentMedianAmount,
  });
  reasons.push(
    ...riskDecision.reasons.filter(
      (reason) =>
        reason !== "low_risk_exact_action" &&
        reason !== "specialized_engine_required",
    ),
  );

  if (action.debt_hint) reasons.push("debt_hint_requires_debt_engine");
  if (action.recurring_hint) {
    reasons.push("recurring_hint_requires_recurring_engine");
  }
  if (action.related_person_hint) {
    reasons.push("related_person_requires_confirmation");
  }

  const accountResolution = resolveAccounts(action, params.accounts);
  reasons.push(...accountResolution.reasons);

  const fatalReasons = reasons.filter((reason) =>
    [
      "account_origin_not_found",
      "account_destination_not_found",
      "missing_amount",
      "missing_description",
      "confidence_below_safe_floor",
    ].includes(reason),
  );

  const confirmationReasons = reasons.filter(
    (reason) => !ACCOUNT_NULL_ALLOWED_REASONS.has(reason),
  );

  const movementInput =
    fatalReasons.length === 0 && action.amount !== null && action.description
      ? buildMovementInput(action, {
          account_origin_id: accountResolution.account_origin_id,
          account_destination_id: accountResolution.account_destination_id,
          receivedAt: params.receivedAt,
          sourceRef: `${params.sourceRef}:${action.action_id}`,
          requiresReview: confirmationReasons.length > 0,
          policyReasons: reasons,
          channel: params.channel,
        })
      : null;

  if (fatalReasons.length > 0) {
    return {
      action_id: action.action_id,
      decision: "blocked",
      risk_level: riskDecision.risk_level,
      reasons,
      movement_input: null,
      debt_payment_input: null,
      debt_creation_input: null,
    };
  }

  if (confirmationReasons.length > 0) {
    return {
      action_id: action.action_id,
      decision: "requires_confirmation",
      risk_level: riskDecision.risk_level,
      reasons,
      movement_input: movementInput,
      debt_payment_input: null,
      debt_creation_input: null,
    };
  }

  return {
    action_id: action.action_id,
    decision: "ready_for_core",
    risk_level: riskDecision.risk_level,
    reasons:
      reasons.length > 0
        ? ["safe_direct_movement", ...reasons]
        : ["safe_direct_movement"],
    movement_input: movementInput,
    debt_payment_input: null,
    debt_creation_input: null,
  };
}

function planDebtCreationAction(
  action: ProposedAction,
  params: {
    accounts: DataActionAccountContext[];
    receivedAt: string;
    confirmedByUser?: boolean;
  },
): PlannedDataAction {
  const reasons: string[] = [];
  const hint = action.debt_hint;
  const directionFromMovementType =
    action.movement_type === "prestamo_recibido"
      ? "i_owe"
      : action.movement_type === "prestamo_dado"
        ? "they_owe_me"
        : null;
  const expectedDirection = hint?.direction ?? directionFromMovementType;
  const personName =
    hint?.person_name?.trim() ?? readRelatedPersonName(action);

  if (hint?.operation !== "create_debt") {
    reasons.push("debt_creation_contract_missing");
  }
  if (!expectedDirection) reasons.push("debt_creation_type_invalid");
  if (
    directionFromMovementType &&
    hint?.direction &&
    directionFromMovementType !== hint.direction
  ) {
    reasons.push("debt_creation_direction_mismatch");
  }
  if (action.amount === null) reasons.push("missing_amount");
  if (!personName) reasons.push("debt_creation_person_missing");
  if (
    hint?.installment_count &&
    !hint.first_due_date
  ) {
    reasons.push("debt_creation_first_due_date_missing");
  }
  if (
    hint?.installment_count &&
    (hint.installment_count < 1 || hint.installment_count > 240)
  ) {
    reasons.push("debt_creation_installment_count_invalid");
  }

  const accountId =
    action.movement_type === "prestamo_recibido"
      ? action.account_destination_id
      : action.account_origin_id;
  if (
    accountId &&
    !params.accounts.some((account) => account.id === accountId)
  ) {
    reasons.push("debt_creation_account_not_found");
  }

  const blockingReasons = new Set([
    "debt_creation_contract_missing",
    "debt_creation_type_invalid",
    "debt_creation_direction_mismatch",
    "missing_amount",
    "debt_creation_person_missing",
    "debt_creation_first_due_date_missing",
    "debt_creation_installment_count_invalid",
    "debt_creation_account_not_found",
  ]);
  const blocked = reasons.some((reason) => blockingReasons.has(reason));
  if (
    blocked ||
    !expectedDirection ||
    action.amount === null ||
    !personName
  ) {
    return {
      action_id: action.action_id,
      decision: "blocked",
      risk_level: "medium",
      reasons: [...new Set(reasons)],
      movement_input: null,
      debt_payment_input: null,
      debt_creation_input: null,
    };
  }

  const input: PlannedDebtCreationInput = {
    direction: expectedDirection,
    kind: hint?.kind ?? "personal",
    name:
      hint?.debt_name?.trim() ||
      (expectedDirection === "i_owe"
        ? `Deuda con ${personName}`
        : `Por cobrar a ${personName}`),
    related_person_name: personName,
    principal_amount: action.amount,
    currency: action.currency,
    opened_at: action.occurred_at?.slice(0, 10) ??
      params.receivedAt.slice(0, 10),
    first_due_date: hint?.first_due_date ?? null,
    installment_count: hint?.installment_count ?? null,
    installment_amount: hint?.installment_amount ?? null,
    interest_notes: null,
    account_id: accountId ?? null,
    movement_type:
      expectedDirection === "i_owe"
        ? "prestamo_recibido"
        : "prestamo_dado",
  };

  if (!params.confirmedByUser) {
    return {
      action_id: action.action_id,
      decision: "blocked",
      risk_level: "medium",
      reasons: ["debt_creation_confirmation_required"],
      movement_input: null,
      debt_payment_input: null,
      debt_creation_input: input,
    };
  }

  return {
    action_id: action.action_id,
    decision: "ready_for_core",
    risk_level: "medium",
    reasons: [
      "safe_specialized_debt_creation",
      "user_confirmation_evidenced",
    ],
    movement_input: null,
    debt_payment_input: null,
    debt_creation_input: input,
  };
}

function planDebtPaymentAction(
  action: ProposedAction,
  params: {
    accounts: DataActionAccountContext[];
    debts?: DataActionDebtContext[];
    sourceRef: string;
    receivedAt: string;
    sourceText?: string | null;
    riskAssessments?: RiskSignalAssessment[];
  }
): PlannedDataAction {
  const reasons: string[] = [];
  if (action.amount === null) reasons.push("missing_amount");
  if (action.confidence < 0.7) reasons.push("confidence_below_safe_floor");

  const debtResolution = resolveDebtForPayment(
    action,
    params.debts ?? []
  );
  reasons.push(...debtResolution.reasons);
  const debt = debtResolution.debt;

  if (debt) {
    const expectedType =
      debt.direction === "i_owe" ? "pago_deuda" : "devolucion_recibida";
    if (action.movement_type !== expectedType) {
      reasons.push("debt_direction_mismatch");
    }
    if (action.currency !== debt.currency) {
      reasons.push("debt_payment_currency_mismatch");
    }
    if (action.amount !== null && action.amount > debt.current_balance) {
      reasons.push("debt_payment_exceeds_balance");
    }
  }

  const proposedAccountId =
    action.movement_type === "pago_deuda"
      ? action.account_origin_id
      : action.account_destination_id;
  const proposedAccount = proposedAccountId
    ? params.accounts.find((candidate) => candidate.id === proposedAccountId) ?? null
    : null;
  const accountId =
    proposedAccountId &&
    hasExplicitAccountEvidence(action, proposedAccount, params.sourceText)
      ? proposedAccountId
      : null;
  if (proposedAccountId && !accountId) {
    reasons.push("debt_payment_account_ignored_without_user_evidence");
  }
  const account = accountId ? proposedAccount : null;
  if (accountId && !account) reasons.push("debt_payment_account_not_found");
  if (account?.currency && debt && account.currency !== debt.currency) {
    reasons.push("debt_payment_account_currency_mismatch");
  }

  const semanticAssessment = params.riskAssessments?.find(
    (assessment) => assessment.action_id === action.action_id
  );
  let riskLevel: RiskLevel = "low";
  if (semanticAssessment && semanticAssessment.confidence >= 0.6) {
    const actionableSignals = semanticAssessment.signals.filter(
      (signal) => signal !== "sensitive_category"
    );
    const sensitivityOnly =
      semanticAssessment.signals.length > 0 && actionableSignals.length === 0;
    if (sensitivityOnly) {
      reasons.push("debt_payment_sensitive_data");
    } else {
      if (semanticAssessment.semantic_level !== "none") {
        riskLevel = maxRiskLevel(riskLevel, semanticAssessment.semantic_level);
      }
      reasons.push(...actionableSignals.map((signal) => `semantic:${signal}`));
      if (semanticAssessment.requires_confirmation_advisory) {
        reasons.push("semantic_confirmation_advisory");
      }
    }
  }

  const fatalReasons = new Set([
    "missing_amount",
    "confidence_below_safe_floor",
    "debt_reference_missing",
    "debt_not_found",
    "debt_reference_ambiguous",
    "debt_direction_mismatch",
    "debt_payment_currency_mismatch",
    "debt_payment_exceeds_balance",
    "debt_payment_account_not_found",
    "debt_payment_account_currency_mismatch",
    "debt_installment_not_found",
    "debt_installment_not_actionable",
    "semantic_confirmation_advisory",
  ]);
  if (riskLevel === "high" || riskLevel === "sensitive") {
    reasons.push("specialized_payment_high_risk");
  }
  const blocked =
    reasons.some((reason) => fatalReasons.has(reason)) ||
    riskLevel === "high" ||
    riskLevel === "sensitive";

  if (blocked || !debt || action.amount === null) {
    return {
      action_id: action.action_id,
      decision: "blocked",
      risk_level: riskLevel,
      reasons: [...new Set(reasons)],
      movement_input: null,
      debt_payment_input: null,
      debt_creation_input: null,
    };
  }

  return {
    action_id: action.action_id,
    decision: "ready_for_core",
    risk_level: riskLevel,
    reasons: ["safe_specialized_debt_payment", ...new Set(reasons)],
    movement_input: null,
    debt_payment_input: {
      debt_id: debt.id,
      debt_name: debt.name,
      amount: action.amount,
      currency: action.currency,
      account_id: accountId,
      installment_id: debtResolution.installment?.id ?? null,
      installment_number: debtResolution.installment?.number ?? null,
      paid_at: action.occurred_at ?? params.receivedAt,
      note: action.description?.trim() ?? null,
      direction: debt.direction,
      previous_balance: debt.current_balance,
    },
    debt_creation_input: null,
  };
}

function hasExplicitAccountEvidence(
  action: ProposedAction,
  account: DataActionAccountContext | null,
  sourceText?: string | null,
): boolean {
  const hasAgentEvidence = action.source_evidence.some((evidence) => {
    if (evidence.source !== "user_text" || !evidence.value.trim()) return false;
    const field = evidence.field.trim().toLowerCase();
    return field.includes("account") || field.includes("cuenta");
  });
  if (!hasAgentEvidence || !sourceText?.trim()) return false;

  const normalizedText = normalizeReference(sourceText);
  if (/\b(?:cuenta|account)\b/.test(normalizedText)) return true;

  const accountName = account?.name ? normalizeReference(account.name) : "";
  return accountName.length >= 2 && normalizedText.includes(accountName);
}

function resolveDebtForPayment(
  action: ProposedAction,
  debts: DataActionDebtContext[]
): {
  debt: DataActionDebtContext | null;
  installment: DataActionDebtContext["installments"][number] | null;
  reasons: string[];
} {
  const hint = action.debt_hint;
  const expectedDirection =
    action.movement_type === "pago_deuda" ? "i_owe" : "they_owe_me";
  let candidates = debts.filter((debt) => debt.direction === expectedDirection);
  const hasHint = Boolean(
    hint?.debt_id ||
      hint?.debt_name ||
      hint?.related_person_id ||
      hint?.person_name ||
      hint?.installment_id ||
      hint?.installment_number
  );

  if (hint?.debt_id) {
    candidates = candidates.filter((debt) => debt.id === hint.debt_id);
  }
  if (hint?.installment_id) {
    candidates = candidates.filter((debt) =>
      debt.installments.some(
        (installment) => installment.id === hint.installment_id
      )
    );
  }
  if (hint?.related_person_id) {
    candidates = candidates.filter(
      (debt) => debt.related_person_id === hint.related_person_id
    );
  }
  if (hint?.debt_name) {
    const target = normalizeReference(hint.debt_name);
    candidates = candidates.filter(
      (debt) => normalizeReference(debt.name) === target
    );
  }
  const personName = hint?.person_name ?? readRelatedPersonName(action);
  if (personName) {
    const target = normalizeReference(personName);
    candidates = candidates.filter((debt) =>
      [debt.related_person_name, ...debt.related_person_aliases]
        .filter((value): value is string => Boolean(value))
        .some((value) => normalizeReference(value) === target)
    );
  }

  if (!hasHint && !personName && candidates.length !== 1) {
    return {
      debt: null,
      installment: null,
      reasons: [
        candidates.length === 0
          ? "debt_reference_missing"
          : "debt_reference_ambiguous",
      ],
    };
  }
  if (candidates.length === 0) {
    return { debt: null, installment: null, reasons: ["debt_not_found"] };
  }
  if (candidates.length > 1) {
    return {
      debt: null,
      installment: null,
      reasons: ["debt_reference_ambiguous"],
    };
  }

  const debt = candidates[0];
  const installmentRequested = Boolean(
    hint?.installment_id || hint?.installment_number
  );
  const installment = installmentRequested
    ? debt.installments.find(
        (candidate) =>
          (!hint?.installment_id || candidate.id === hint.installment_id) &&
          (!hint?.installment_number ||
            candidate.number === hint.installment_number)
      ) ?? null
    : null;
  if (installmentRequested && !installment) {
    return { debt, installment: null, reasons: ["debt_installment_not_found"] };
  }
  if (installment) {
    const oldestOpen = [...debt.installments].sort((left, right) =>
      left.due_date === right.due_date
        ? left.number - right.number
        : left.due_date.localeCompare(right.due_date)
    )[0];
    if (!oldestOpen || oldestOpen.id !== installment.id) {
      return {
        debt,
        installment,
        reasons: ["debt_installment_not_actionable"],
      };
    }
  }

  return { debt, installment, reasons: [] };
}

function readRelatedPersonName(action: ProposedAction): string | null {
  const hint = action.related_person_hint;
  if (!hint || typeof hint !== "object") return null;
  for (const key of ["display_name", "person_name", "name"]) {
    const value = hint[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function normalizeReference(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function maxRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "sensitive"];
  return order[Math.max(order.indexOf(left), order.indexOf(right))];
}

function markMovementInputForReview(
  movementInput: MovementInput | null,
  policyReasons: string[],
): MovementInput | null {
  if (!movementInput) return null;

  return {
    ...movementInput,
    requires_review: true,
    metadata: {
      ...movementInput.metadata,
      policy_reasons: policyReasons,
    },
  };
}

function resolveAccounts(
  action: ProposedAction,
  accounts: DataActionAccountContext[],
): {
  account_origin_id: string | null;
  account_destination_id: string | null;
  reasons: string[];
} {
  const reasons: string[] = [];
  const defaultAccount = accounts.find((account) => account.is_default);
  const onlyAccount = accounts.length === 1 ? accounts[0] : null;
  const fallbackAccount = defaultAccount ?? onlyAccount ?? null;

  let accountOriginId = action.account_origin_id;
  let accountDestinationId = action.account_destination_id;

  if (
    accountOriginId &&
    !accounts.some((account) => account.id === accountOriginId)
  ) {
    reasons.push("account_origin_not_found");
  }

  if (
    accountDestinationId &&
    !accounts.some((account) => account.id === accountDestinationId)
  ) {
    reasons.push("account_destination_not_found");
  }

  if (action.movement_type === "gasto" && !accountOriginId) {
    accountOriginId = fallbackAccount?.id ?? null;
    if (!accountOriginId) reasons.push("account_origin_null_allowed");
  }

  if (action.movement_type === "ingreso" && !accountDestinationId) {
    accountDestinationId = fallbackAccount?.id ?? null;
    if (!accountDestinationId) {
      reasons.push("account_destination_null_allowed");
    }
  }

  return {
    account_origin_id: accountOriginId,
    account_destination_id: accountDestinationId,
    reasons,
  };
}

// domain.ts nombra esta variante "dashboard_manual", no "dashboard": el
// unico punto donde los dos vocabularios se traducen.
function toMovementSource(channel: Channel): "whatsapp" | "dashboard_manual" {
  return channel === "whatsapp" ? "whatsapp" : "dashboard_manual";
}

function buildMovementInput(
  action: ProposedAction,
  params: {
    account_origin_id: string | null;
    account_destination_id: string | null;
    receivedAt: string;
    sourceRef: string;
    requiresReview: boolean;
    policyReasons: string[];
    channel: Channel;
  },
): MovementInput {
  return {
    type: action.movement_type,
    amount: action.amount,
    currency: action.currency,
    occurred_at: action.occurred_at ?? params.receivedAt,
    description: action.description?.trim() ?? null,
    merchant: action.description?.trim() ?? null,
    category_id: action.category_id,
    subcategory_id: action.subcategory_id,
    account_origin_id: params.account_origin_id,
    account_destination_id: params.account_destination_id,
    box_origin_id: action.box_origin_id,
    box_destination_id: action.box_destination_id,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: toMovementSource(params.channel),
    source_ref: params.sourceRef,
    confidence: action.confidence,
    requires_review: params.requiresReview,
    metadata: {
      agent_action_id: action.action_id,
      source_evidence: action.source_evidence,
      policy_reasons: params.policyReasons,
      generated_by: "data_agent",
    },
  };
}
