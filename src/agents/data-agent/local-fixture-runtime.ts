import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime/types";
import {
  DataAgentOutputSchema,
  type Ambiguity,
  type DataAgentOutput,
  type DataContextPack,
  type EvidenceSignal,
  type LocalDataMovementDraft,
} from "./types";

const CATEGORY_BY_KEYWORD = [
  {
    categoryId: "alimentacion",
    keywords: ["cafe", "almuerzo", "comida", "desayuno", "cena"],
  },
  {
    categoryId: "transporte",
    keywords: ["taxi", "uber", "bus", "metropolitano", "movilidad"],
  },
  {
    categoryId: "compras_personales",
    keywords: ["supermercado", "tienda", "ropa", "compra"],
  },
] as const;

export class LocalFixtureDataAgentRuntime implements AgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const startedAt = Date.now();
    if (request.agent_name !== "data_agent") {
      throw new Error("LocalFixtureDataAgentRuntime solo soporta data_agent");
    }

    const context = request.context_pack as DataContextPack;
    const output =
      completeActiveCaptureDraft(context) ?? extractDataAgentOutput(context);

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "local-fixture-data-agent-v1",
        latency_ms: Date.now() - startedAt,
        cost_estimate: 0,
      },
      safety: {
        policy_flags: ["local_fixture_not_production_llm"],
        redaction_applied: false,
      },
    };
  }
}

export function extractDataAgentOutput(context: DataContextPack): DataAgentOutput {
  const normalized = normalizeText(context.original_message);
  const debtCreationOutput = extractDebtCreationOutput(context, normalized);
  if (debtCreationOutput) return debtCreationOutput;
  const debtPaymentOutput = extractDebtPaymentOutput(context, normalized);
  if (debtPaymentOutput) return debtPaymentOutput;

  const drafts = extractMovementDrafts(normalized);

  if (drafts.length === 0) {
    const output: DataAgentOutput = {
      intent: detectConversationIntent(normalized) ? "conversation" : "unknown",
      confidence: 0.2,
      result: [],
      ambiguities: [
        {
          field: "intent",
          reason: "No hay suficiente evidencia estructurada para proponer movimiento.",
          question: "Quieres registrarlo como gasto, ingreso o revisar otra cosa?",
          risk_level: "low",
        },
      ],
      requires_confirmation: true,
      evidence_signals: [],
      safe_explanation: "No hay suficiente informacion para proponer un registro.",
    };
    return DataAgentOutputSchema.parse(output);
  }

  const result = drafts.map((draft, index) => ({
    action_id: `action_${index + 1}`,
    movement_type: draft.movementType,
    amount: draft.amount,
    currency: "PEN" as const,
    occurred_at: context.received_at,
    description: draft.description,
    category_id: draft.categoryId,
    subcategory_id: null,
    tags: draft.categoryId === "transporte" ? ["movilidad"] : [],
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_hint: null,
    recurring_hint: null,
    related_person_hint: null,
    source_evidence: [
      ...(draft.amount !== null
        ? [
            {
              field: "amount",
              value: String(draft.amount),
              source: "user_text" as const,
            },
          ]
        : []),
      ...(draft.description
        ? [
            {
              field: "description",
              value: draft.description,
              source: "user_text" as const,
            },
          ]
        : []),
      ...(draft.categoryId
        ? [
            {
              field: "category_id",
              value: draft.categoryId,
              source: "rule" as const,
            },
          ]
        : []),
      {
        field: "occurred_at",
        value: context.received_at,
        source: "rule" as const,
      },
    ],
    confidence: draft.confidence,
  }));

  const averageConfidence =
    result.reduce((sum, action) => sum + action.confidence, 0) / result.length;
  const output: DataAgentOutput = {
    intent:
      result.length === 1 ? "record_movement" : "record_multiple_movements",
    confidence: Number(averageConfidence.toFixed(2)),
    result,
    ambiguities: [],
    requires_confirmation: result.some((action) => action.confidence < 0.75),
    evidence_signals: result.flatMap((action) => action.source_evidence),
    safe_explanation:
      result.length === 1
        ? "Se detecto un posible movimiento."
        : `Se detectaron ${result.length} posibles movimientos.`,
  };

  return DataAgentOutputSchema.parse(output);
}

function extractDebtCreationOutput(
  context: DataContextPack,
  normalized: string,
): DataAgentOutput | null {
  const received = normalized.match(
    /\b([a-z][a-z ]{0,38}?)\s+me\s+presto\s+(?:s\s*)?(\d+(?:[.,]\d{1,2})?)/,
  );
  const given = normalized.match(
    /\b(?:le\s+)?preste\s+(?:s\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles?)?\s+a\s+([a-z][a-z ]{0,38})/,
  );
  const iOwe = normalized.match(
    /\ble\s+debo\s+(?:s\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles?)?\s+a\s+([a-z][a-z ]{0,38})/,
  );
  const theyOwe = normalized.match(
    /\b([a-z][a-z ]{0,38}?)\s+me\s+debe\s+(?:s\s*)?(\d+(?:[.,]\d{1,2})?)/,
  );

  let direction: "i_owe" | "they_owe_me";
  let movementType: "prestamo_recibido" | "prestamo_dado";
  let personName: string;
  let amountValue: string;
  if (received) {
    direction = "i_owe";
    movementType = "prestamo_recibido";
    personName = titleCase(received[1]!);
    amountValue = received[2]!;
  } else if (given) {
    direction = "they_owe_me";
    movementType = "prestamo_dado";
    amountValue = given[1]!;
    personName = titleCase(given[2]!);
  } else if (iOwe) {
    direction = "i_owe";
    movementType = "prestamo_recibido";
    amountValue = iOwe[1]!;
    personName = titleCase(iOwe[2]!);
  } else if (theyOwe) {
    direction = "they_owe_me";
    movementType = "prestamo_dado";
    personName = titleCase(theyOwe[1]!);
    amountValue = theyOwe[2]!;
  } else {
    return null;
  }

  const amount = parseAmount(amountValue);
  if (amount === null) return null;
  const installmentMatch = normalized.match(
    /\b(?:en|pagar(?:e|a)?\s+en)\s+(\d{1,3})\s+cuotas?\b/,
  );
  const installmentCount = installmentMatch
    ? Number(installmentMatch[1])
    : null;
  const firstDueDate = extractFirstDueDate(
    normalized,
    context.received_at,
  );
  const actionId = "action_1";
  const evidence: EvidenceSignal[] = [
    {
      field: "amount",
      value: String(amount),
      source: "user_text",
    },
    {
      field: "person_name",
      value: personName,
      source: "user_text",
    },
    {
      field: "debt_direction",
      value: direction,
      source: "user_text",
    },
    ...(installmentCount
      ? [
          {
            field: "installment_count",
            value: String(installmentCount),
            source: "user_text" as const,
          },
        ]
      : []),
    ...(firstDueDate
      ? [
          {
            field: "first_due_date",
            value: firstDueDate,
            source: "user_text" as const,
          },
        ]
      : []),
  ];
  const ambiguities: Ambiguity[] =
    installmentCount && !firstDueDate
      ? [
          {
            field: "first_due_date",
            reason:
              "Falta la fecha de vencimiento de la primera cuota para crear el calendario.",
            scope: "financial_action",
            action_id: actionId,
            question: "Cuando vence la primera cuota?",
            risk_level: "medium",
          },
        ]
      : [];

  return DataAgentOutputSchema.parse({
    intent: "record_movement",
    confidence: 0.96,
    result: [
      {
        action_id: actionId,
        movement_type: movementType,
        amount,
        currency: "PEN",
        occurred_at: null,
        description: `Deuda con ${personName}`,
        category_id: null,
        subcategory_id: null,
        tags: [],
        account_origin_id: null,
        account_destination_id: null,
        box_origin_id: null,
        box_destination_id: null,
        debt_hint: {
          operation: "create_debt",
          direction,
          kind: "personal",
          debt_id: null,
          debt_name: `Deuda con ${personName}`,
          related_person_id: null,
          person_name: personName,
          installment_id: null,
          installment_number: null,
          installment_count: installmentCount,
          installment_amount:
            installmentCount !== null
              ? Math.round((amount / installmentCount) * 100) / 100
              : null,
          first_due_date: firstDueDate,
        },
        recurring_hint: null,
        related_person_hint: {
          display_name: personName,
        },
        source_evidence: evidence,
        confidence: 0.96,
      },
    ],
    ambiguities,
    requires_confirmation: true,
    evidence_signals: evidence,
    safe_explanation:
      ambiguities.length > 0
        ? "Entendi la deuda y las cuotas, pero falta la fecha de la primera cuota."
        : "Entendi la deuda. El Debt Engine debe validarla antes de crearla.",
  });
}

function extractDebtPaymentOutput(
  context: DataContextPack,
  normalized: string
): DataAgentOutput | null {
  if (!hasDebtPaymentVerb(normalized)) return null;

  const debts = context.active_debts ?? [];
  const debtNameMatches = debts.filter((debt) =>
    includesReference(normalized, debt.name)
  );
  const personMatches = debts.filter((debt) =>
    [debt.related_person_name, ...debt.related_person_aliases]
      .filter((value): value is string => Boolean(value))
      .some((value) => includesReference(normalized, value))
  );
  const candidates =
    debtNameMatches.length > 0 ? debtNameMatches : personMatches;
  const hasDebtSemanticSignal =
    /\b(deuda|prestamo|cuotas?|saldo (?:pendiente|restante)|restantes?)\b/.test(
      normalized
    );

  if (candidates.length === 0) {
    if (!hasDebtSemanticSignal) return null;
    return buildUnresolvedDebtPaymentOutput();
  }

  const amountAndCurrency = extractDebtPaymentAmountAndCurrency(normalized);
  const exactDebt = candidates.length === 1 ? candidates[0] : null;
  const candidateDirections = new Set(
    candidates.map((candidate) => candidate.direction)
  );
  if (!exactDebt && candidateDirections.size !== 1) {
    return buildUnresolvedDebtPaymentOutput();
  }
  const matchedPerson = findMatchedPersonReference(normalized, candidates);
  const installmentNumber = extractInstallmentNumber(normalized);
  const installment =
    exactDebt && installmentNumber !== null
      ? exactDebt.installments.find(
          (candidate) => candidate.number === installmentNumber
        ) ?? null
      : null;
  const debtHint = exactDebt
    ? {
        debt_id: exactDebt.id,
        debt_name: exactDebt.name,
        related_person_id: exactDebt.related_person_id,
        person_name: exactDebt.related_person_name,
        installment_id: installment?.id ?? null,
        installment_number: installmentNumber,
      }
    : {
        person_name: matchedPerson,
      };
  const movementType =
    (exactDebt?.direction ?? candidates[0]?.direction) === "they_owe_me"
      ? ("devolucion_recibida" as const)
      : ("pago_deuda" as const);
  const amount = amountAndCurrency?.amount ?? null;
  const currency =
    amountAndCurrency?.currency ?? exactDebt?.currency ?? "PEN";
  const confidence = exactDebt ? 0.99 : 0.96;
  const ambiguities: Ambiguity[] = [];
  if (amount === null) {
    ambiguities.push({
      field: "amount",
      reason: "Falta el monto del pago de deuda.",
      scope: "financial_action" as const,
      action_id: "action_1",
      question: "Cuanto pagaste?",
      risk_level: "medium" as const,
    });
  }

  const sourceEvidence: EvidenceSignal[] = [
    {
      field: "debt_reference",
      value: exactDebt?.name ?? matchedPerson ?? "referencia no resuelta",
      source: "context_pack" as const,
    },
  ];
  if (amount !== null) {
    sourceEvidence.push({
      field: "amount",
      value: String(amount),
      source: "user_text" as const,
    });
  }

  return DataAgentOutputSchema.parse({
    intent: "record_movement",
    confidence,
    result: [
      {
        action_id: "action_1",
        movement_type: movementType,
        amount,
        currency,
        occurred_at: context.received_at,
        description: context.original_message.trim(),
        category_id: null,
        subcategory_id: null,
        tags: [],
        account_origin_id: null,
        account_destination_id: null,
        box_origin_id: null,
        box_destination_id: null,
        debt_hint: debtHint,
        recurring_hint: null,
        related_person_hint: null,
        source_evidence: sourceEvidence,
        confidence,
      },
    ],
    ambiguities,
    requires_confirmation: amount === null,
    evidence_signals: sourceEvidence,
    safe_explanation: exactDebt
      ? "Se detecto un pago asociado a una deuda activa."
      : "Se detecto un pago de deuda que el Core debe desambiguar.",
  });
}

function buildUnresolvedDebtPaymentOutput(): DataAgentOutput {
  return DataAgentOutputSchema.parse({
    intent: "unknown",
    confidence: 0.4,
    result: [],
    ambiguities: [
      {
        field: "debt_reference",
        reason: "La referencia no coincide con una deuda activa.",
        scope: "financial_action",
        question: "A que deuda corresponde el pago?",
        risk_level: "medium",
      },
    ],
    requires_confirmation: true,
    evidence_signals: [],
    safe_explanation:
      "No se convirtio el pago de deuda en un movimiento generico.",
  });
}

function hasDebtPaymentVerb(text: string): boolean {
  return /\b(pague|pago|pagar|pagado|abone|abono|cancele|cancelo)\b/.test(text);
}

function includesReference(text: string, reference: string): boolean {
  const normalizedReference = normalizeText(reference);
  return normalizedReference.length >= 2 && text.includes(normalizedReference);
}

function findMatchedPersonReference(
  text: string,
  debts: NonNullable<DataContextPack["active_debts"]>
): string | null {
  for (const debt of debts) {
    for (const reference of [
      debt.related_person_name,
      ...debt.related_person_aliases,
    ]) {
      if (reference && includesReference(text, reference)) return reference;
    }
  }
  return null;
}

function extractDebtPaymentAmountAndCurrency(
  text: string
): { amount: number; currency: "PEN" | "USD" | null } | null {
  const explicit = text.match(
    /\b(\d+(?:[.,]\d{1,2})?)\s*(soles?|sol|pen|dolares?|usd)\b/
  );
  if (explicit) {
    const amount = parseAmount(explicit[1]);
    if (amount === null) return null;
    return {
      amount,
      currency: /dolar|usd/.test(explicit[2]) ? "USD" : "PEN",
    };
  }

  const amountMatch = text.match(/\b(\d+(?:[.,]\d{1,2})?)\b/);
  const amount = amountMatch ? parseAmount(amountMatch[1]) : null;
  return amount === null ? null : { amount, currency: null };
}

function extractInstallmentNumber(text: string): number | null {
  if (/\b(?:primera|primer) cuota\b/.test(text)) return 1;
  if (/\bsegunda cuota\b/.test(text)) return 2;
  if (/\btercera cuota\b/.test(text)) return 3;
  const match = text.match(/\bcuota\s*(\d+)\b/);
  return match ? Number(match[1]) : null;
}

function completeActiveCaptureDraft(
  context: DataContextPack
): DataAgentOutput | null {
  const draftOutput = context.active_capture_draft?.data_agent_output;
  if (!draftOutput) return null;

  const debtCreationAction = draftOutput.result.find(
    (action) =>
      action.debt_hint?.operation === "create_debt" &&
      action.debt_hint.installment_count &&
      !action.debt_hint.first_due_date,
  );
  if (debtCreationAction) {
    const firstDueDate = extractFirstDueDate(
      normalizeText(context.original_message),
      context.received_at,
    );
    if (firstDueDate) {
      const result = draftOutput.result.map((action) =>
        action.action_id === debtCreationAction.action_id
          ? {
              ...action,
              debt_hint: {
                ...action.debt_hint!,
                first_due_date: firstDueDate,
              },
              source_evidence: [
                ...action.source_evidence,
                {
                  field: "first_due_date",
                  value: firstDueDate,
                  source: "user_text" as const,
                },
              ],
            }
          : action,
      );
      const ambiguities = draftOutput.ambiguities.filter(
        (ambiguity) =>
          ambiguity.field !== "first_due_date" ||
          ambiguity.action_id !== debtCreationAction.action_id,
      );
      return DataAgentOutputSchema.parse({
        ...draftOutput,
        result,
        ambiguities,
        requires_confirmation: true,
        confidence: Math.max(draftOutput.confidence, 0.97),
        evidence_signals: [
          ...draftOutput.evidence_signals,
          {
            field: "first_due_date",
            value: firstDueDate,
            source: "user_text",
          },
        ],
        safe_explanation:
          "Complete la fecha de la primera cuota. La deuda aun requiere confirmacion.",
      });
    }
  }

  const incompleteActions = draftOutput.result.filter(
    (action) => action.amount === null
  );
  if (incompleteActions.length !== 1) return null;

  const amount = extractContinuationAmount(context.original_message);
  if (amount === null) return null;

  const targetActionId = incompleteActions[0].action_id;
  const result = draftOutput.result.map((action) =>
    action.action_id === targetActionId
      ? {
          ...action,
          amount,
          confidence: Math.max(action.confidence, 0.98),
          source_evidence: [
            ...action.source_evidence,
            {
              field: "amount",
              value: String(amount),
              source: "user_text" as const,
            },
          ],
        }
      : action
  );
  const ambiguities = draftOutput.ambiguities.filter(
    (ambiguity) =>
      ambiguity.field !== "amount" ||
      (ambiguity.action_id !== undefined &&
        ambiguity.action_id !== null &&
        ambiguity.action_id !== targetActionId)
  );
  const evidenceSignals = [
    ...draftOutput.evidence_signals,
    {
      field: "amount",
      value: String(amount),
      source: "user_text" as const,
    },
  ];
  const requiresConfirmation = ambiguities.some(
    (ambiguity) => ambiguity.scope === "financial_action" || !ambiguity.scope
  );
  const confidence =
    result.reduce((sum, action) => sum + action.confidence, 0) / result.length;

  return DataAgentOutputSchema.parse({
    ...draftOutput,
    intent: result.length === 1 ? "record_movement" : "record_multiple_movements",
    result,
    ambiguities,
    requires_confirmation: requiresConfirmation,
    confidence: Number(confidence.toFixed(2)),
    evidence_signals: evidenceSignals,
    safe_explanation: "Se completo el dato que faltaba en el borrador financiero.",
  });
}

const MONTH_INDEX: Record<string, number> = {
  enero: 1,
  febrero: 2,
  marzo: 3,
  abril: 4,
  mayo: 5,
  junio: 6,
  julio: 7,
  agosto: 8,
  septiembre: 9,
  setiembre: 9,
  octubre: 10,
  noviembre: 11,
  diciembre: 12,
};

function extractFirstDueDate(
  normalizedText: string,
  receivedAt: string,
): string | null {
  const iso = normalizedText.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return isIsoDate(iso[1]!) ? iso[1]! : null;

  const numeric = normalizedText.match(
    /\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/,
  );
  if (numeric) {
    return validDateParts(
      Number(numeric[3]),
      Number(numeric[2]),
      Number(numeric[1]),
    );
  }

  const words = normalizedText.match(
    /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)(?:\s+de\s+(20\d{2}))?\b/,
  );
  if (!words) return null;
  const received = new Date(receivedAt);
  let year = words[3]
    ? Number(words[3])
    : Number.isNaN(received.getTime())
      ? new Date().getUTCFullYear()
      : received.getUTCFullYear();
  const month = MONTH_INDEX[words[2]!]!;
  const day = Number(words[1]);
  let result = validDateParts(year, month, day);
  if (
    result &&
    !words[3] &&
    !Number.isNaN(received.getTime()) &&
    result < received.toISOString().slice(0, 10)
  ) {
    year += 1;
    result = validDateParts(year, month, day);
  }
  return result;
}

function validDateParts(
  year: number,
  month: number,
  day: number,
): string | null {
  const value = `${String(year).padStart(4, "0")}-${String(month).padStart(
    2,
    "0",
  )}-${String(day).padStart(2, "0")}`;
  return isIsoDate(value) ? value : null;
}

function isIsoDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function titleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function extractContinuationAmount(text: string): number | null {
  const normalized = normalizeText(text);
  const hasMoneyMarker =
    /\b(soles?|sol|pen)\b/.test(normalized) || /\bs\s*\d/.test(normalized);
  const startsWithAmount = /^\s*\d+(?:[.,]\d{1,2})?\b/.test(normalized);
  if (!hasMoneyMarker && !startsWithAmount) return null;

  const match = normalized.match(/\b(\d+(?:[.,]\d{1,2})?)\b/);
  return match ? parseAmount(match[1]) : null;
}

function extractMovementDrafts(text: string): LocalDataMovementDraft[] {
  if (!shouldAttemptFinancialCapture(text)) return [];

  const drafts = [
    ...extractAmountFirstDrafts(text),
    ...extractDescriptionFirstDrafts(text),
  ];

  return dedupeMovementDrafts(drafts);
}

function extractAmountFirstDrafts(text: string): LocalDataMovementDraft[] {
  const matches = Array.from(
    text.matchAll(
      /(?:^|\s|,|;|y\s+)(?:s\s*)?(\d+(?:[.,]\d{1,2})?)\s*(?:soles?|pen)?\s*(?:en|de|por|para|comprando|compra|el|la|los|las)?\s+([a-z][a-z ]{1,40}?)(?=,|;|\sy\s+(?:s\s*)?\d|$)/g
    )
  );

  return matches
    .map((match) => buildExpenseDraft(match[1], match[2]))
    .filter((draft): draft is LocalDataMovementDraft => draft !== null);
}

function extractDescriptionFirstDrafts(text: string): LocalDataMovementDraft[] {
  const matches = Array.from(
    text.matchAll(
      /\b(?:compre|comprando|pague|pago|registra|registre|anota|apunta|guarda|me salio|me costo)\s+([a-z][a-z ]{1,40}?)\s+(?:por|a|en|de)?\s*(?:s\s*)?(\d+(?:[.,]\d{1,2})?)(?:\s*soles?)?\b/g
    )
  );

  return matches
    .map((match) => buildExpenseDraft(match[2], match[1]))
    .filter((draft): draft is LocalDataMovementDraft => draft !== null);
}

function buildExpenseDraft(
  amountValue: string,
  descriptionValue: string
): LocalDataMovementDraft | null {
  const amount = parseAmount(amountValue);
  const description = cleanDescription(descriptionValue);
  if (amount === null || !description) return null;

  const categoryId = inferCategoryId(description);
  return {
    movementType: "gasto",
    amount,
    description,
    categoryId,
    confidence: categoryId ? 0.9 : 0.72,
    evidenceValue: `${amountValue} ${description}`,
  };
}

function shouldAttemptFinancialCapture(text: string): boolean {
  if (!hasFinancialCaptureSignal(text)) return false;
  if (isFinancialQuestionOrHypothetical(text) && !hasExplicitCaptureCommand(text)) {
    return false;
  }

  return true;
}

function hasFinancialCaptureSignal(text: string): boolean {
  return /\b(gaste|gasto|hice un gasto|pague|pago|compre|comprando|me salio|me costo|anota|apunta|registra|registre|registralo|guarda|guardalo)\b/.test(
    text
  );
}

function hasExplicitCaptureCommand(text: string): boolean {
  return /\b(anota|apunta|registra|registre|registralo|guarda|guardalo)\b/.test(
    text
  );
}

function isFinancialQuestionOrHypothetical(text: string): boolean {
  return /\b(puedo|podria|si gasto|que pasa si|cuanto|que gaste|que gastos|en que gaste|me puedes decir|puedes decirme|dime|consulta)\b/.test(
    text
  );
}

function dedupeMovementDrafts(
  drafts: LocalDataMovementDraft[]
): LocalDataMovementDraft[] {
  const seen = new Set<string>();
  const deduped: LocalDataMovementDraft[] = [];

  for (const draft of drafts) {
    const key = `${draft.movementType}:${draft.amount}:${draft.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(draft);
  }

  return deduped;
}

function parseAmount(value: string): number | null {
  const amount = Number(value.replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return amount;
}

function inferCategoryId(description: string) {
  for (const item of CATEGORY_BY_KEYWORD) {
    if (item.keywords.some((keyword) => description.includes(keyword))) {
      return item.categoryId;
    }
  }

  return null;
}

function cleanDescription(value: string): string {
  return value
    .replace(
      /\b(en|de|por|para|hoy|ayer|sol|soles|pen|comprando|compra|el|la|los|las|un|una)\b/g,
      " "
    )
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s,.;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectConversationIntent(text: string): boolean {
  return (
    text.includes("?") ||
    /\b(puedo|como voy|tengo libre|cuanto tengo|cuanto me queda)\b/.test(text)
  );
}
