import type {
  Account,
  Box,
  CategoryId,
  Debt,
  DebtPayment,
  InsightType,
  Movement,
  MovementTag,
  RecurringCandidate,
  RiskLevel,
  Tag,
} from "@/shared/types/domain";
import { calculateMoneyLayers } from "@/core/finance/money-layers";

export type InsightCurrency = "PEN" | "USD";

export type InsightCommitment = {
  id: string;
  title: string;
  amount: number;
  currency: InsightCurrency;
  due_at: string;
  kind: "recurring" | "debt";
  linked_box_id: string | null;
};

export type InsightBudget = {
  id: string;
  category_id: CategoryId | null;
  category_name: string | null;
  period_start: string;
  period_end: string;
  amount: number;
  spent: number;
  status: "activo" | "pausado" | "archivado";
};

export type InsightGoal = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  box_id: string | null;
  current_balance: number | null;
  status: "activa" | "alcanzada" | "pausada" | "archivada";
};

export type InsightProjection = {
  currency: "PEN";
  period_start: string;
  period_end: string;
  as_of: string;
  free_money_cents: number;
  uncovered_commitments_cents: number;
  observed_days: number;
  daily_pace_cents: number;
  days_remaining: number;
  sufficient_data: boolean;
  projection_cents: number | null;
  range: { min_cents: number; max_cents: number } | null;
  assumption_refs: string[];
  movement_refs: string[];
};

export type InsightProfileFact = {
  id: string;
  subject_key: string;
  statement: string;
  origin: "dicho" | "observado_confirmado";
  status: "vigente" | "en_duda" | "suspendido" | "olvidado" | "caducado" | "reemplazado";
  expires_at: string | null;
  positive_evidence_refs: string[];
};

export type InsightAction = {
  type:
    | "view_movements"
    | "assign_account"
    | "watch_category"
    | "review_debt"
    | "confirm_recurring"
    | "view_money"
    | "adjust_budget"
    | "link_goal"
    | "create_box"
    | "dismiss";
  target_view: "movements" | "money" | "debts" | "upcoming" | "insights";
  filters?: Record<string, unknown>;
};

export type InsightDraft = {
  type: InsightType;
  fingerprint: string;
  periodStart: string;
  periodEnd: string;
  confidence: number;
  qualityScore: number;
  rankScore: number;
  riskLevel: RiskLevel;
  title: string;
  body: string;
  evidenceText: string;
  evidence: Record<string, unknown>;
  sourceFacts: Record<string, unknown>;
  sourceEntityIds: string[];
  action: InsightAction | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
};

export type InsightEngineInput = {
  movements: Movement[];
  debts?: Debt[];
  debtPayments?: DebtPayment[];
  recurringCandidates?: RecurringCandidate[];
  accounts?: Account[];
  boxes?: Box[];
  commitments?: InsightCommitment[];
  budgets?: InsightBudget[];
  goals?: InsightGoal[];
  projection?: InsightProjection | null;
  profileFacts?: InsightProfileFact[];
  movementTags?: MovementTag[];
  tags?: Tag[];
  activePendingCount?: number;
  activePendingIds?: string[];
  now?: Date;
  timezone?: string;
};

const spendTypes = new Set<Movement["type"]>([
  "gasto",
  "pago_recurrente",
  "pago_deuda",
]);

const categoryLabels: Record<CategoryId, string> = {
  alimentacion: "Alimentacion",
  transporte: "Transporte",
  vivienda_hogar: "Vivienda y hogar",
  servicios_suscripciones: "Servicios y suscripciones",
  salud: "Salud",
  educacion: "Educacion",
  ocio_salidas: "Ocio y salidas",
  compras_personales: "Compras personales",
  familia_apoyo: "Familia y apoyo",
  deudas: "Deudas",
  trabajo_productividad: "Trabajo y productividad",
  otros: "Otros",
};

export function buildAdvancedInsightDrafts(
  input: InsightEngineInput,
): InsightDraft[] {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? "America/Lima";
  const today = localIsoDate(now, timezone);
  const confirmed = input.movements.filter(isConfirmedMovement);
  const spend = confirmed.filter((movement) => spendTypes.has(movement.type));
  const drafts: InsightDraft[] = [];

  drafts.push(
    ...buildBudgetRiskInsights({
      budgets: input.budgets ?? [],
      spend,
      today,
      now,
      timezone,
    }),
  );
  drafts.push(
    ...buildGoalPaceInsights({
      goals: input.goals ?? [],
      movements: confirmed,
      today,
      now,
      timezone,
    }),
  );
  const uncovered = buildCommitmentUncoveredInsight({
    commitments: input.commitments ?? [],
    today,
    now,
  });
  if (uncovered) drafts.push(uncovered);

  const debtDrafts = buildDebtInsights({
    debts: input.debts ?? [],
    payments: input.debtPayments ?? [],
    today,
    now,
  });
  drafts.push(...debtDrafts);

  const recurring = buildRecurringInsight({
    candidates: input.recurringCandidates ?? [],
    today,
    now,
  });
  if (recurring) drafts.push(recurring);

  const freeMoneyDrafts = buildFreeMoneyInsights({
    accounts: input.accounts ?? [],
    boxes: input.boxes ?? [],
    commitments: input.commitments ?? [],
    today,
    now,
  });
  drafts.push(...freeMoneyDrafts);

  const boxProgress = buildBoxProgressInsight({
    accounts: input.accounts ?? [],
    boxes: input.boxes ?? [],
    today,
    now,
  });
  if (boxProgress) drafts.push(boxProgress);

  const dataQuality = buildDataQualityInsight({
    confirmed,
    activePendingCount: input.activePendingCount ?? 0,
    activePendingIds: input.activePendingIds ?? [],
    today,
    now,
  });
  if (dataQuality) drafts.push(dataQuality);

  const concentration = buildCategoryConcentrationInsight({
    spend,
    today,
    now,
    timezone,
  });
  if (concentration) drafts.push(concentration);

  const comparison = buildWeeklyComparisonInsight({
    spend,
    today,
    now,
    timezone,
  });
  if (comparison) drafts.push(comparison);

  const temporal = buildTemporalPatternInsight({
    spend,
    today,
    now,
    timezone,
  });
  if (temporal) drafts.push(temporal);

  const anomaly = buildAnomalyInsight({ spend, today, now, timezone });
  if (anomaly) drafts.push(anomaly);

  const merchant = buildMerchantPatternInsight({ spend, today, now, timezone });
  if (merchant) drafts.push(merchant);

  const projection = buildProjectionInsight(input.projection ?? null, now);
  if (projection) drafts.push(projection);

  const contextual = buildContextualInsight({
    movements: spend,
    movementTags: input.movementTags ?? [],
    tags: input.tags ?? [],
    profileFacts: input.profileFacts ?? [],
    today,
    now,
    timezone,
  });
  if (contextual) drafts.push(contextual);

  if (confirmed.length >= 3 && drafts.length === 0) {
    drafts.push(buildLearningProgressInsight(confirmed, today, now));
  }

  return drafts
    .filter((draft) => draft.qualityScore >= 55 && draft.confidence >= 0.6)
    .sort(compareDrafts)
    .slice(0, 8);
}

function buildBudgetRiskInsights(input: {
  budgets: InsightBudget[];
  spend: Movement[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft[] {
  return input.budgets.flatMap((budget) => {
    if (
      budget.status !== "activo" ||
      budget.period_start > input.today ||
      budget.period_end < input.today ||
      budget.amount <= 0
    ) {
      return [];
    }
    const movements = filterByLocalDate(
      input.spend,
      budget.period_start,
      budget.period_end,
      input.timezone,
    ).filter((movement) =>
      budget.category_id == null
        ? true
        : movement.category_id === budget.category_id,
    );
    if (movements.length < 3) return [];

    const elapsedDays = daysBetweenIsoDates(budget.period_start, input.today) + 1;
    const periodDays = daysBetweenIsoDates(budget.period_start, budget.period_end) + 1;
    const spent = sumAmounts(movements);
    const projected = roundMoney((spent / elapsedDays) * periodDays);
    if (projected <= budget.amount) return [];
    const daysToLimit = Math.max(1, Math.ceil(budget.amount / (spent / elapsedDays)));
    const projectedLimitDate = shiftIsoDate(budget.period_start, daysToLimit - 1);
    const label = budget.category_name ?? "Tu presupuesto general";

    return [{
      type: "budget_risk",
      fingerprint: `budget_risk:${budget.id}:${budget.period_start}`,
      periodStart: budget.period_start,
      periodEnd: budget.period_end,
      confidence: 1,
      qualityScore: 92,
      rankScore: 94,
      riskLevel: budget.category_id === "salud" ? "sensitive" : "medium",
      title: `${label} llegaria al limite antes de cerrar el periodo`,
      body: `Llevas ${formatPen(spent)} en ${movements.length} gastos. Al ritmo actual, el limite de ${formatPen(budget.amount)} se alcanzaria alrededor del ${projectedLimitDate}.`,
      evidenceText: `${formatPen(spent)} de ${formatPen(budget.amount)}; proyeccion ${formatPen(projected)}`,
      evidence: {
        budget_id: budget.id,
        category_id: budget.category_id,
        period_start: budget.period_start,
        period_end: budget.period_end,
        elapsed_days: elapsedDays,
        period_days: periodDays,
        movement_count: movements.length,
        spent: roundMoney(spent),
        budget_amount: roundMoney(budget.amount),
        projected_amount: projected,
        projected_limit_date: projectedLimitDate,
        exclusions: ["transferencias", "ajustes", "pendientes"],
      },
      sourceFacts: {
        budget_id: budget.id,
        category_id: budget.category_id,
        movement_count: movements.length,
        spent: roundMoney(spent),
        budget_amount: roundMoney(budget.amount),
        projected_amount: projected,
        projected_limit_date: projectedLimitDate,
      },
      sourceEntityIds: [budget.id, ...movements.map((movement) => movement.id)],
      action: {
        type: "adjust_budget",
        target_view: "insights",
        filters: { budget_id: budget.id },
      },
      expiresAt: shiftIsoDate(budget.period_end, 1),
      metadata: { signal_version: "insight-engine-v3", class: "A" },
    }];
  });
}

function buildGoalPaceInsights(input: {
  goals: InsightGoal[];
  movements: Movement[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft[] {
  return input.goals.flatMap((goal) => {
    if (
      goal.status !== "activa" ||
      !goal.target_date ||
      goal.target_date <= input.today ||
      !goal.box_id ||
      goal.current_balance == null ||
      goal.target_amount <= 0
    ) {
      return [];
    }
    const contributions = input.movements.filter(
      (movement) =>
        movement.box_destination_id === goal.box_id &&
        movement.occurred_at != null &&
        localIsoDate(new Date(movement.occurred_at), input.timezone) <= input.today,
    );
    if (contributions.length < 2) return [];
    const firstDate = minLocalDate(contributions, input.timezone) ?? input.today;
    const elapsedDays = Math.max(1, daysBetweenIsoDates(firstDate, input.today) + 1);
    const remainingDays = daysBetweenIsoDates(input.today, goal.target_date);
    const contributed = sumAmounts(contributions);
    const projected = roundMoney(
      Number(goal.current_balance) + (contributed / elapsedDays) * remainingDays,
    );
    const onPace = projected >= goal.target_amount;

    return [{
      type: "goal_pace",
      fingerprint: `goal_pace:${goal.id}:${goal.target_date}`,
      periodStart: firstDate,
      periodEnd: goal.target_date,
      confidence: 1,
      qualityScore: 88,
      rankScore: onPace ? 82 : 91,
      riskLevel: "low",
      title: onPace
        ? `${goal.name} va al ritmo de su fecha`
        : `${goal.name} no llegaria a su fecha al ritmo actual`,
      body: `Con ${contributions.length} aportes y ${formatPen(Number(goal.current_balance))} separados, el ritmo actual proyecta ${formatPen(projected)} para el ${goal.target_date}.`,
      evidenceText: `${contributions.length} aportes; meta ${formatPen(goal.target_amount)}`,
      evidence: {
        goal_id: goal.id,
        box_id: goal.box_id,
        contribution_count: contributions.length,
        contributed: roundMoney(contributed),
        current_balance: roundMoney(Number(goal.current_balance)),
        target_amount: roundMoney(goal.target_amount),
        target_date: goal.target_date,
        projected_amount: projected,
        on_pace: onPace,
      },
      sourceFacts: {
        goal_id: goal.id,
        goal_name: goal.name,
        contribution_count: contributions.length,
        current_balance: roundMoney(Number(goal.current_balance)),
        target_amount: roundMoney(goal.target_amount),
        target_date: goal.target_date,
        projected_amount: projected,
        on_pace: onPace,
      },
      sourceEntityIds: [goal.id, goal.box_id, ...contributions.map((item) => item.id)],
      action: {
        type: "link_goal",
        target_view: "money",
        filters: { goal_id: goal.id, box_id: goal.box_id },
      },
      expiresAt: goal.target_date,
      metadata: { signal_version: "insight-engine-v3", class: "A" },
    }];
  });
}

function buildCommitmentUncoveredInsight(input: {
  commitments: InsightCommitment[];
  today: string;
  now: Date;
}): InsightDraft | null {
  const windowEnd = shiftIsoDate(input.today, 30);
  const uncovered = input.commitments
    .filter(
      (commitment) =>
        commitment.due_at.slice(0, 10) >= input.today &&
        commitment.due_at.slice(0, 10) <= windowEnd &&
        commitment.linked_box_id == null,
    )
    .sort((left, right) => left.due_at.localeCompare(right.due_at));
  if (uncovered.length === 0) return null;
  const selected = uncovered[0];
  return {
    type: "commitment_uncovered",
    fingerprint: `commitment_uncovered:${selected.kind}:${selected.id}`,
    periodStart: input.today,
    periodEnd: selected.due_at.slice(0, 10),
    confidence: 1,
    qualityScore: 90,
    rankScore: 93,
    riskLevel: "medium",
    title: `${selected.title} viene sin dinero apartado`,
    body: `${formatCurrency(selected.amount, selected.currency)} vencen el ${selected.due_at.slice(0, 10)} y el compromiso no esta vinculado a una caja.`,
    evidenceText: `${formatCurrency(selected.amount, selected.currency)} con vencimiento ${selected.due_at.slice(0, 10)}`,
    evidence: {
      commitment_id: selected.id,
      kind: selected.kind,
      amount: roundMoney(selected.amount),
      currency: selected.currency,
      due_at: selected.due_at,
      linked_box_id: null,
    },
    sourceFacts: {
      commitment_id: selected.id,
      title: selected.title,
      kind: selected.kind,
      amount: roundMoney(selected.amount),
      currency: selected.currency,
      due_at: selected.due_at,
    },
    sourceEntityIds: [selected.id],
    action: { type: "create_box", target_view: "money" },
    expiresAt: selected.due_at,
    metadata: { signal_version: "insight-engine-v3", class: "A" },
  };
}

function buildProjectionInsight(
  projection: InsightProjection | null,
  now: Date,
): InsightDraft | null {
  if (!projection?.sufficient_data) return null;
  const refs = [...new Set([
    ...projection.movement_refs,
    ...projection.assumption_refs,
  ])];
  if (refs.length === 0) return null;
  const range = projection.range
    ? {
        min: projection.range.min_cents / 100,
        max: projection.range.max_cents / 100,
      }
    : null;
  const point = projection.projection_cents == null
    ? null
    : projection.projection_cents / 100;
  const body = range
    ? `Con el ritmo observado y los compromisos conocidos, el cierre estaria entre ${formatPen(range.min)} y ${formatPen(range.max)}.`
    : `Con el ritmo observado y los compromisos conocidos, el cierre seria ${formatPen(point ?? 0)}.`;
  return {
    type: "projection",
    fingerprint: `projection:${projection.period_start}:${projection.period_end}`,
    periodStart: projection.period_start,
    periodEnd: projection.period_end,
    confidence: 1,
    qualityScore: 86,
    rankScore: 84,
    riskLevel: "low",
    title: "Asi vendria el cierre del periodo",
    body,
    evidenceText: `${projection.observed_days} dias observados; ${projection.days_remaining} por venir`,
    evidence: {
      period_start: projection.period_start,
      period_end: projection.period_end,
      as_of: projection.as_of,
      observed_days: projection.observed_days,
      days_remaining: projection.days_remaining,
      free_money: roundMoney(projection.free_money_cents / 100),
      uncovered_commitments: roundMoney(
        projection.uncovered_commitments_cents / 100,
      ),
      daily_pace: roundMoney(projection.daily_pace_cents / 100),
      projection: point == null ? null : roundMoney(point),
      range,
      assumptions: [
        "mediana de gasto diario en dias civiles de Lima",
        "solo compromisos conocidos",
        "sin ingresos futuros no declarados",
      ],
    },
    sourceFacts: {
      observed_days: projection.observed_days,
      days_remaining: projection.days_remaining,
      projection: point == null ? null : roundMoney(point),
      range,
    },
    sourceEntityIds: refs,
    action: { type: "view_money", target_view: "money", filters: { projection: true } },
    expiresAt: addDays(now, Math.max(1, projection.days_remaining + 1)).toISOString(),
    metadata: { signal_version: "insight-engine-v3", class: "A" },
  };
}

function buildDebtInsights(input: {
  debts: Debt[];
  payments: DebtPayment[];
  today: string;
  now: Date;
}): InsightDraft[] {
  const active = input.debts
    .filter(
      (debt) =>
        debt.deleted_at == null &&
        ["active", "due_soon", "overdue"].includes(debt.status) &&
        Number(debt.current_balance) > 0,
    )
    .sort(compareDebtPriority);
  if (active.length === 0) return [];

  const drafts: InsightDraft[] = [];
  const priorityDebt = active[0];
  drafts.push(buildDebtStatusInsight(priorityDebt, input.today));

  const paymentsByDebt = new Map<string, DebtPayment[]>();
  for (const payment of input.payments) {
    if (!active.some((debt) => debt.id === payment.debt_id)) continue;
    paymentsByDebt.set(payment.debt_id, [
      ...(paymentsByDebt.get(payment.debt_id) ?? []),
      payment,
    ]);
  }

  const progressDebt = active
    .map((debt) => ({
      debt,
      payments: paymentsByDebt.get(debt.id) ?? [],
      progress: debtProgressRatio(debt),
    }))
    .filter(
      (candidate) =>
        candidate.payments.length > 0 &&
        candidate.progress > 0 &&
        candidate.progress < 1,
    )
    .sort((left, right) => right.progress - left.progress)[0];
  if (progressDebt) {
    drafts.push(
      buildDebtProgressInsight(
        progressDebt.debt,
        progressDebt.payments,
        progressDebt.progress,
        input.today,
      ),
    );
  }

  return drafts;
}

function buildDebtStatusInsight(debt: Debt, today: string): InsightDraft {
  const balance = roundMoney(Number(debt.current_balance));
  const dueAt = debt.next_payment_date ?? debt.due_date;
  const userOwes = debt.direction === "i_owe";
  const title =
    debt.status === "overdue"
      ? userOwes
        ? "Hay una deuda que necesita tu atencion"
        : "Tienes un cobro que sigue pendiente"
      : debt.status === "due_soon"
        ? userOwes
          ? "Tienes un pago de deuda proximo"
          : "Tienes un cobro proximo"
        : userOwes
          ? `${debt.name} sigue activa`
          : `${debt.name} sigue por cobrar`;
  const body = dueAt
    ? `${debt.name} tiene ${formatCurrency(balance, debt.currency)} pendientes y una fecha relevante el ${dueAt}.`
    : `${debt.name} tiene ${formatCurrency(balance, debt.currency)} pendientes. No hay una fecha proxima configurada.`;

  return {
    type: "debt",
    fingerprint: `debt:${debt.id}`,
    periodStart: debt.opened_at.slice(0, 10),
    periodEnd: today,
    confidence: 1,
    qualityScore: debt.status === "overdue" ? 88 : debt.status === "due_soon" ? 82 : 70,
    rankScore: debt.status === "overdue" ? 92 : debt.status === "due_soon" ? 84 : 68,
    riskLevel: "sensitive",
    title,
    body,
    evidenceText: dueAt
      ? `${formatCurrency(balance, debt.currency)} pendientes; fecha ${dueAt}`
      : `${formatCurrency(balance, debt.currency)} pendientes`,
    evidence: {
      debt_id: debt.id,
      debt_name: debt.name,
      direction: debt.direction,
      status: debt.status,
      current_balance: balance,
      currency: debt.currency,
      due_at: dueAt,
    },
    sourceFacts: {
      debt_name: debt.name,
      direction: debt.direction,
      status: debt.status,
      current_balance: balance,
      currency: debt.currency,
      due_at: dueAt,
    },
    sourceEntityIds: [debt.id],
    action: {
      type: "review_debt",
      target_view: "debts",
      filters: { debt_id: debt.id },
    },
    expiresAt: null,
    metadata: { signal_version: "insight-engine-v2", domain: "debt" },
  };
}

function buildDebtProgressInsight(
  debt: Debt,
  payments: DebtPayment[],
  progress: number,
  today: string,
): InsightDraft {
  const principal = roundMoney(Number(debt.principal_amount));
  const remaining = roundMoney(Number(debt.current_balance));
  const paid = roundMoney(Math.max(principal - remaining, 0));
  const progressPercent = Math.round(progress * 100);
  const userOwes = debt.direction === "i_owe";

  return {
    type: "progress",
    fingerprint: `progress:debt:${debt.id}`,
    periodStart: debt.opened_at.slice(0, 10),
    periodEnd: today,
    confidence: 1,
    qualityScore: 84,
    rankScore: 80,
    riskLevel: "sensitive",
    title: userOwes
      ? `Ya avanzaste ${progressPercent}% en ${debt.name}`
      : `Ya recuperaste ${progressPercent}% de ${debt.name}`,
    body: userOwes
      ? `Has reducido ${formatCurrency(paid, debt.currency)} y quedan ${formatCurrency(remaining, debt.currency)}.`
      : `Ya recibiste ${formatCurrency(paid, debt.currency)} y quedan ${formatCurrency(remaining, debt.currency)} por cobrar.`,
    evidenceText: `${payments.length} pagos registrados; ${formatCurrency(remaining, debt.currency)} pendientes`,
    evidence: {
      debt_id: debt.id,
      debt_name: debt.name,
      principal_amount: principal,
      paid_amount: paid,
      current_balance: remaining,
      progress_ratio: roundDecimal(progress),
      progress_percent: progressPercent,
      payment_count: payments.length,
      currency: debt.currency,
    },
    sourceFacts: {
      debt_name: debt.name,
      principal_amount: principal,
      paid_amount: paid,
      current_balance: remaining,
      progress_percent: progressPercent,
      payment_count: payments.length,
      currency: debt.currency,
    },
    sourceEntityIds: [debt.id, ...payments.map((payment) => payment.id)],
    action: {
      type: "review_debt",
      target_view: "debts",
      filters: { debt_id: debt.id },
    },
    expiresAt: null,
    metadata: { signal_version: "insight-engine-v2", domain: "debt_progress" },
  };
}

function buildRecurringInsight(input: {
  candidates: RecurringCandidate[];
  today: string;
  now: Date;
}): InsightDraft | null {
  const candidate = input.candidates
    .filter((item) => ["ready_to_suggest", "suggested"].includes(item.status))
    .sort((left, right) => right.confidence - left.confidence)[0];
  if (!candidate) return null;

  const evidence = asRecord(candidate.evidence);
  const movementCount = recordNumber(evidence, "movement_count");
  const amount = recordNumber(evidence, "inferred_amount");
  const displayName = recordString(evidence, "display_name");
  const frequency = recordString(evidence, "inferred_frequency");
  const nextExpectedDate = recordString(evidence, "next_expected_date");
  const currency = recordCurrency(evidence, "currency");
  const movementIds = recordStringArray(evidence, "movement_ids");
  if (
    movementCount == null ||
    movementCount < 3 ||
    amount == null ||
    amount <= 0 ||
    !displayName ||
    !frequency ||
    !currency
  ) {
    return null;
  }

  return {
    type: "recurring",
    fingerprint: `recurring:candidate:${candidate.id}`,
    periodStart: recordString(evidence, "first_seen") ?? input.today,
    periodEnd: input.today,
    confidence: clamp(candidate.confidence, 0, 1),
    qualityScore: roundScore(66 + candidate.confidence * 24),
    rankScore: roundScore(63 + candidate.confidence * 22),
    riskLevel: candidate.category_id === "salud" ? "sensitive" : "medium",
    title: `${displayName} parece repetirse`,
    body:
      "Manzana encontro un patron, pero no lo convertira en pago recurrente hasta que tu lo confirmes.",
    evidenceText: `${movementCount} movimientos; monto habitual ${formatCurrency(amount, currency)}`,
    evidence: {
      recurring_candidate_id: candidate.id,
      display_name: displayName,
      movement_count: movementCount,
      inferred_amount: roundMoney(amount),
      inferred_frequency: frequency,
      next_expected_date: nextExpectedDate,
      currency,
      confidence: roundDecimal(candidate.confidence),
    },
    sourceFacts: {
      display_name: displayName,
      movement_count: movementCount,
      inferred_amount: roundMoney(amount),
      inferred_frequency: frequency,
      next_expected_date: nextExpectedDate,
      currency,
    },
    sourceEntityIds: [candidate.id, ...movementIds],
    action: {
      type: "confirm_recurring",
      target_view: "upcoming",
      filters: { recurring_candidate_id: candidate.id },
    },
    expiresAt: null,
    metadata: { signal_version: "insight-engine-v2", domain: "recurring" },
  };
}

function buildFreeMoneyInsights(input: {
  accounts: Account[];
  boxes: Box[];
  commitments: InsightCommitment[];
  today: string;
  now: Date;
}): InsightDraft[] {
  const activeAccounts = input.accounts.filter(
    (account) => account.deleted_at == null && isInsightCurrency(account.currency),
  );
  const currencies = [
    ...new Set(activeAccounts.map((account) => account.currency as InsightCurrency)),
  ];

  return currencies.flatMap((currency) => {
    const accounts = activeAccounts.filter((account) => account.currency === currency);
    const accountIds = new Set(accounts.map((account) => account.id));
    const boxes = input.boxes.filter(
      (box) => box.deleted_at == null && accountIds.has(box.account_id),
    );
    const commitments = input.commitments.filter(
      (commitment) => commitment.currency === currency,
    );
    const layers = calculateMoneyLayers({
      accounts: accounts.map((account) => ({ current_balance: Number(account.current_balance) })),
      boxes: boxes.map((box) => ({ id: box.id, current_balance: Number(box.current_balance) })),
      commitments: commitments.map((commitment) => ({
        id: commitment.id,
        amount: Number(commitment.amount),
        linked_box_id: commitment.linked_box_id,
        due_at: commitment.due_at,
      })),
    });
    const totalBalance = layers.total_balance;
    const separated = layers.separated_in_boxes;
    const uncoveredCommitments = layers.upcoming_uncovered_commitments;
    if (separated <= 0 && uncoveredCommitments <= 0) return [];

    const freeInAccounts = layers.free_in_accounts;
    const operationalFreeMoney = layers.operational_free_money;
    const sourceIds = [
      ...accounts.map((account) => account.id),
      ...boxes.map((box) => box.id),
      ...commitments.map((commitment) => commitment.id),
    ];

    return [
      {
        type: "free_money" as const,
        fingerprint: `free_money:${currency}`,
        periodStart: input.today,
        periodEnd: input.today,
        confidence: 1,
        qualityScore: 86,
        rankScore: 82,
        riskLevel: "sensitive" as const,
        title: `Tu dinero libre operativo es ${formatCurrency(operationalFreeMoney, currency)}`,
        body: `De ${formatCurrency(totalBalance, currency)} en cuentas, ${formatCurrency(separated, currency)} estan separados y ${formatCurrency(uncoveredCommitments, currency)} cubren compromisos proximos.`,
        evidenceText: `${formatCurrency(freeInAccounts, currency)} libres en cuentas antes de compromisos`,
        evidence: {
          currency,
          total_balance: totalBalance,
          separated_in_boxes: separated,
          free_in_accounts: freeInAccounts,
          upcoming_uncovered_commitments: uncoveredCommitments,
          operational_free_money: operationalFreeMoney,
          account_count: accounts.length,
          box_count: boxes.length,
          commitment_count: commitments.length,
        },
        sourceFacts: {
          currency,
          total_balance: totalBalance,
          separated_in_boxes: separated,
          free_in_accounts: freeInAccounts,
          upcoming_uncovered_commitments: uncoveredCommitments,
          operational_free_money: operationalFreeMoney,
        },
        sourceEntityIds: sourceIds,
        action: { type: "view_money" as const, target_view: "money" as const },
        expiresAt: null,
        metadata: { signal_version: "insight-engine-v2", domain: "balance" },
      },
    ];
  });
}

function buildContextualInsight(input: {
  movements: Movement[];
  movementTags: MovementTag[];
  tags: Tag[];
  profileFacts: InsightProfileFact[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft | null {
  const periodStart = shiftIsoDate(input.today, -27);
  const recentMovements = filterByLocalDate(
    input.movements,
    periodStart,
    input.today,
    input.timezone,
  );
  const movementById = new Map(
    recentMovements.map((movement) => [movement.id, movement]),
  );
  const tagById = new Map(
    input.tags
      .filter((tag) => tag.type === "contextual")
      .map((tag) => [tag.id, tag]),
  );
  const eligibleAssignments = input.movementTags.filter(
    (assignment) =>
      movementById.has(assignment.movement_id) &&
      tagById.has(assignment.tag_id) &&
      (assignment.confidence == null || assignment.confidence >= 0.7),
  );
  const assignmentsByTag = new Map<string, MovementTag[]>();
  for (const assignment of eligibleAssignments) {
    assignmentsByTag.set(assignment.tag_id, [
      ...(assignmentsByTag.get(assignment.tag_id) ?? []),
      assignment,
    ]);
  }

  const activeFacts = input.profileFacts.filter(
    (fact) =>
      fact.status === "vigente" &&
      (fact.expires_at == null || fact.expires_at > input.now.toISOString()),
  );
  const selected = [...assignmentsByTag.entries()]
    .map(([tagId, assignments]) => {
      const movements = assignments
        .map((assignment) => movementById.get(assignment.movement_id))
        .filter((movement): movement is Movement => Boolean(movement));
      const tag = tagById.get(tagId);
      const fact = tag
        ? activeFacts.find(
            (candidate) =>
              candidate.subject_key.toLocaleLowerCase("es-PE").includes(tag.key.toLocaleLowerCase("es-PE")) ||
              candidate.positive_evidence_refs.includes(tag.id) ||
              movements.some((movement) => candidate.positive_evidence_refs.includes(movement.id)),
          )
        : undefined;
      return {
        tag,
        fact,
        movements,
      };
    })
    .filter(
      (candidate) =>
        candidate.tag != null &&
        candidate.fact != null &&
        candidate.movements.length >= 1,
    )
    .sort((left, right) => right.movements.length - left.movements.length)[0];
  if (!selected?.tag || !selected.fact) return null;

  const totalAmount = sumAmounts(selected.movements);
  return {
    type: "contextual",
    fingerprint: `contextual:${selected.fact.id}:${selected.tag.id}:${periodStart}`,
    periodStart,
    periodEnd: input.today,
    confidence: 1,
    qualityScore: 78,
    rankScore: 72,
    riskLevel: "medium",
    title: `${selected.fact.statement} aparece en tus movimientos`,
    body: `En los ultimos 28 dias hay ${selected.movements.length} movimientos con la etiqueta ${selected.tag.label}. Es contexto confirmado por ti, no un diagnostico.`,
    evidenceText: `${selected.movements.length} movimientos etiquetados por ${formatPen(totalAmount)}`,
    evidence: {
      tag_id: selected.tag.id,
      tag_key: selected.tag.key,
      tag_label: selected.tag.label,
      profile_fact_id: selected.fact.id,
      profile_statement: selected.fact.statement,
      movement_count: selected.movements.length,
      total_amount: roundMoney(totalAmount),
    },
    sourceFacts: {
      tag_label: selected.tag.label,
      profile_statement: selected.fact.statement,
      movement_count: selected.movements.length,
      total_amount: roundMoney(totalAmount),
    },
    sourceEntityIds: [
      selected.fact.id,
      selected.tag.id,
      ...selected.movements.map((movement) => movement.id),
    ],
    action: {
      type: "view_movements",
      target_view: "movements",
      filters: {
        tag_id: selected.tag.id,
        date_from: periodStart,
        date_to: input.today,
      },
    },
    expiresAt: addDays(input.now, 30).toISOString(),
    metadata: { signal_version: "insight-engine-v2", domain: "contextual" },
  };
}

function buildBoxProgressInsight(input: {
  accounts: Account[];
  boxes: Box[];
  today: string;
  now: Date;
}): InsightDraft | null {
  const currencyByAccount = new Map(
    input.accounts
      .filter(
        (account) => account.deleted_at == null && isInsightCurrency(account.currency),
      )
      .map((account) => [account.id, account.currency as InsightCurrency]),
  );
  const selected = input.boxes
    .map((box) => {
      const currency = currencyByAccount.get(box.account_id);
      const target = Number(box.target_amount);
      const current = Number(box.current_balance);
      return {
        box,
        currency,
        target,
        current,
        progress: target > 0 ? current / target : 0,
      };
    })
    .filter(
      (candidate) =>
        candidate.box.deleted_at == null &&
        candidate.currency != null &&
        candidate.target > 0 &&
        candidate.current > 0 &&
        candidate.progress > 0,
    )
    .sort((left, right) => right.progress - left.progress)[0];
  if (!selected || !selected.currency) return null;

  const progressPercent = Math.round(selected.progress * 100);
  const reached = selected.progress >= 1;
  return {
    type: "box_saving",
    fingerprint: `box_saving:${selected.box.id}`,
    periodStart: selected.box.created_at.slice(0, 10),
    periodEnd: input.today,
    confidence: 1,
    qualityScore: reached ? 90 : 80,
    rankScore: reached ? 88 : 76,
    riskLevel: "sensitive",
    title: reached
      ? `${selected.box.name} ya alcanzo su objetivo`
      : `${selected.box.name} va en ${progressPercent}%`,
    body: `Tienes ${formatCurrency(selected.current, selected.currency)} separados de una meta de ${formatCurrency(selected.target, selected.currency)}.`,
    evidenceText: `${progressPercent}% de la meta configurada`,
    evidence: {
      box_id: selected.box.id,
      box_name: selected.box.name,
      current_balance: roundMoney(selected.current),
      target_amount: roundMoney(selected.target),
      progress_ratio: roundDecimal(selected.progress),
      progress_percent: progressPercent,
      currency: selected.currency,
      target_date: selected.box.target_date,
    },
    sourceFacts: {
      box_name: selected.box.name,
      current_balance: roundMoney(selected.current),
      target_amount: roundMoney(selected.target),
      progress_percent: progressPercent,
      currency: selected.currency,
      target_date: selected.box.target_date,
    },
    sourceEntityIds: [selected.box.id, selected.box.account_id],
    action: { type: "view_money", target_view: "money" },
    expiresAt: null,
    metadata: { signal_version: "insight-engine-v2", domain: "box" },
  };
}

function buildLearningProgressInsight(
  movements: Movement[],
  today: string,
  now: Date,
): InsightDraft {
  const categoryCount = new Set(
    movements.map((movement) => movement.category_id).filter(Boolean),
  ).size;
  const confidence = clamp(0.62 + Math.min(movements.length, 10) * 0.02, 0, 0.82);
  return {
    type: "learning_progress",
    fingerprint: "learning_progress:first_value",
    periodStart: minLocalDate(movements, "America/Lima") ?? today,
    periodEnd: today,
    confidence,
    qualityScore: 62,
    rankScore: 58,
    riskLevel: "low",
    title: "Manzana ya esta aprendiendo contigo",
    body:
      "Todavia no hay un patron fuerte, pero tus registros ya permiten ordenar primeras senales sin asumir lo que falta.",
    evidenceText: `${movements.length} movimientos confirmados`,
    evidence: {
      movement_count: movements.length,
      category_count: categoryCount,
      exclusions: ["pendientes", "movimientos eliminados"],
    },
    sourceFacts: {
      movement_count: movements.length,
      category_count: categoryCount,
    },
    sourceEntityIds: movements.map((movement) => movement.id),
    action: null,
    expiresAt: addDays(now, 7).toISOString(),
    metadata: { signal_version: "insight-engine-v1", stage: "first_value" },
  };
}

function buildDataQualityInsight(input: {
  confirmed: Movement[];
  activePendingCount: number;
  activePendingIds: string[];
  today: string;
  now: Date;
}): InsightDraft | null {
  const withoutAccount = input.confirmed.filter(
    (movement) =>
      movement.account_origin_id == null && movement.account_destination_id == null,
  );
  const ratio = input.confirmed.length > 0
    ? withoutAccount.length / input.confirmed.length
    : 0;
  if (withoutAccount.length === 0 && input.activePendingCount === 0) return null;

  const confidence = 1;
  const pendingOnly = withoutAccount.length === 0;
  return {
    type: "data_quality",
    fingerprint: pendingOnly
      ? "data_quality:pending_confirmation"
      : "data_quality:missing_account",
    periodStart: minOccurredDate(input.confirmed) ?? input.today,
    periodEnd: input.today,
    confidence,
    qualityScore: 82,
    rankScore: 80,
    riskLevel: "low",
    title: pendingOnly
      ? "Hay un pendiente que aun no forma parte de tus numeros"
      : "Una parte de tu historia aun no mueve saldos",
    body: pendingOnly
      ? "Confirmarlo o descartarlo permite calcular con datos cerrados."
      : "Hay movimientos confirmados sin cuenta. Siguen en tu historial, pero asignarlos haria mas preciso tu dinero libre.",
    evidenceText: pendingOnly
      ? `${input.activePendingCount} pendiente(s) sin confirmar`
      : `${withoutAccount.length} de ${input.confirmed.length} movimientos sin cuenta`,
    evidence: {
      movement_count: input.confirmed.length,
      without_account_count: withoutAccount.length,
      ratio: roundDecimal(ratio),
      active_pending_count: input.activePendingCount,
      exclusions: ["pendientes", "movimientos eliminados"],
    },
    sourceFacts: {
      movement_count: input.confirmed.length,
      without_account_count: withoutAccount.length,
      active_pending_count: input.activePendingCount,
    },
    sourceEntityIds: pendingOnly
      ? input.activePendingIds
      : withoutAccount.map((movement) => movement.id),
    action: pendingOnly
      ? { type: "view_movements", target_view: "movements", filters: { pending: true } }
      : { type: "assign_account", target_view: "movements" },
    expiresAt: null,
    metadata: { signal_version: "insight-engine-v1" },
  };
}

function buildCategoryConcentrationInsight(input: {
  spend: Movement[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft | null {
  const periodStart = shiftIsoDate(input.today, -29);
  const period = filterByLocalDate(
    input.spend,
    periodStart,
    input.today,
    input.timezone,
  ).filter((movement) => movement.category_id != null);
  if (period.length < 10) return null;

  const total = sumAmounts(period);
  if (total < 50) return null;
  const totals = groupAmountByCategory(period);
  const [categoryId, categoryAmount] = [...totals.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0] ?? [null, 0];
  if (!categoryId) return null;

  const categoryMovements = period.filter(
    (movement) => movement.category_id === categoryId,
  );
  const share = categoryAmount / total;
  if (categoryMovements.length < 3 || share < 0.45 || categoryAmount < 30) {
    return null;
  }

  const label = categoryLabels[categoryId];
  const confidence = clamp(
    0.58 + Math.min(categoryMovements.length, 10) * 0.025 + share * 0.18,
    0,
    0.94,
  );
  return {
    type: "category_concentration",
    fingerprint: `category_concentration:${periodStart}:${categoryId}`,
    periodStart,
    periodEnd: input.today,
    confidence,
    qualityScore: roundScore(52 + confidence * 30 + share * 12),
    rankScore: roundScore(50 + confidence * 25 + Math.min(categoryAmount / total, 1) * 18),
    riskLevel: categoryId === "salud" ? "sensitive" : "low",
    title: `${label} concentro una parte importante de tus gastos`,
    body:
      "No significa que este mal: solo fue la categoria que mas peso tuvo en el periodo.",
    evidenceText: `${formatPen(categoryAmount)} de ${formatPen(total)} en ${categoryMovements.length} movimientos`,
    evidence: {
      period_start: periodStart,
      period_end: input.today,
      movement_count: period.length,
      category_movement_count: categoryMovements.length,
      category_id: categoryId,
      category_amount: roundMoney(categoryAmount),
      total_amount: roundMoney(total),
      share: roundDecimal(share),
      exclusions: ["transferencias", "prestamos", "pendientes"],
    },
    sourceFacts: {
      category_id: categoryId,
      category_label: label,
      category_amount: roundMoney(categoryAmount),
      total_amount: roundMoney(total),
      movement_count: categoryMovements.length,
    },
    sourceEntityIds: categoryMovements.map((movement) => movement.id),
    action: {
      type: "view_movements",
      target_view: "movements",
      filters: { category_id: categoryId, date_from: periodStart, date_to: input.today },
    },
    expiresAt: addDays(input.now, 7).toISOString(),
    metadata: { signal_version: "insight-engine-v1" },
  };
}

function buildWeeklyComparisonInsight(input: {
  spend: Movement[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft | null {
  const currentStart = shiftIsoDate(input.today, -6);
  const previousEnd = shiftIsoDate(input.today, -7);
  const previousStart = shiftIsoDate(input.today, -13);
  const current = filterByLocalDate(
    input.spend,
    currentStart,
    input.today,
    input.timezone,
  );
  const previous = filterByLocalDate(
    input.spend,
    previousStart,
    previousEnd,
    input.timezone,
  );
  if (current.length < 5 || previous.length < 5) return null;

  const currentTotal = sumAmounts(current);
  const previousTotal = sumAmounts(previous);
  if (previousTotal < 20) return null;
  const delta = currentTotal - previousTotal;
  const change = delta / previousTotal;
  if (Math.abs(change) < 0.15 || Math.abs(delta) < 20) return null;

  const progress = change < 0;
  const confidence = clamp(
    0.62 + Math.min(current.length + previous.length, 24) * 0.012,
    0,
    0.92,
  );
  const type: InsightType = progress ? "progress" : "comparative";
  return {
    type,
    fingerprint: `${type}:weekly:${currentStart}`,
    periodStart: currentStart,
    periodEnd: input.today,
    confidence,
    qualityScore: roundScore(55 + confidence * 30 + Math.min(Math.abs(change), 1) * 10),
    rankScore: roundScore(
      53 + confidence * 24 + Math.min(Math.abs(delta) / 100, 1) * 16,
    ),
    riskLevel: "low",
    title: progress
      ? "Esta semana tus gastos bajaron"
      : "Esta semana tus gastos subieron",
    body: progress
      ? "Es una mejora concreta frente a los siete dias anteriores."
      : "El cambio es visible frente a los siete dias anteriores; puedes revisar que lo explico.",
    evidenceText: `${formatPen(currentTotal)} frente a ${formatPen(previousTotal)} (${formatPercent(change)})`,
    evidence: {
      period_start: currentStart,
      period_end: input.today,
      baseline_start: previousStart,
      baseline_end: previousEnd,
      movement_count: current.length,
      baseline_movement_count: previous.length,
      current_total: roundMoney(currentTotal),
      baseline_total: roundMoney(previousTotal),
      delta: roundMoney(delta),
      change_ratio: roundDecimal(change),
      exclusions: ["transferencias", "prestamos", "pendientes"],
    },
    sourceFacts: {
      current_total: roundMoney(currentTotal),
      baseline_total: roundMoney(previousTotal),
      delta: roundMoney(delta),
      change_percent: Math.round(change * 100),
      direction: progress ? "down" : "up",
    },
    sourceEntityIds: [...current, ...previous].map((movement) => movement.id),
    action: {
      type: "view_movements",
      target_view: "movements",
      filters: { date_from: currentStart, date_to: input.today },
    },
    expiresAt: startOfNextWeek(input.now).toISOString(),
    metadata: { signal_version: "insight-engine-v1", comparison: "rolling_7d" },
  };
}

function buildTemporalPatternInsight(input: {
  spend: Movement[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft | null {
  const periodStart = shiftIsoDate(input.today, -27);
  const period = filterByLocalDate(
    input.spend,
    periodStart,
    input.today,
    input.timezone,
  );
  if (!hasMinimumSpan(period, 21, input.timezone)) return null;

  const counts = new Map<number, Movement[]>();
  for (const movement of period) {
    const weekday = localWeekday(new Date(movement.occurred_at), input.timezone);
    counts.set(weekday, [...(counts.get(weekday) ?? []), movement]);
  }
  const [weekday, selected] = [...counts.entries()].sort(
    (left, right) => right[1].length - left[1].length,
  )[0] ?? [0, []];
  const share = selected.length / period.length;
  if (selected.length < 3) return null;

  const label = weekdayLabel(weekday);
  const confidence = clamp(0.61 + selected.length * 0.018 + share * 0.18, 0, 0.91);
  return {
    type: "temporal_pattern",
    fingerprint: `temporal_pattern:weekday:${weekday}:${periodStart}`,
    periodStart,
    periodEnd: input.today,
    confidence,
    qualityScore: roundScore(54 + confidence * 31 + share * 9),
    rankScore: roundScore(50 + confidence * 26 + share * 14),
    riskLevel: "low",
    title: `Los ${label} se repiten mas en tus gastos`,
    body:
      "Es una concentracion de frecuencia, no un juicio sobre tus decisiones.",
    evidenceText: `${selected.length} de ${period.length} gastos ocurrieron ese dia`,
    evidence: {
      period_start: periodStart,
      period_end: input.today,
      weekday,
      weekday_label: label,
      movement_count: period.length,
      matching_movement_count: selected.length,
      share: roundDecimal(share),
    },
    sourceFacts: {
      weekday_label: label,
      movement_count: period.length,
      matching_movement_count: selected.length,
    },
    sourceEntityIds: selected.map((movement) => movement.id),
    action: {
      type: "view_movements",
      target_view: "movements",
      filters: { weekday, date_from: periodStart, date_to: input.today },
    },
    expiresAt: addDays(input.now, 30).toISOString(),
    metadata: { signal_version: "insight-engine-v1" },
  };
}

function buildAnomalyInsight(input: {
  spend: Movement[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft | null {
  const baselineStart = shiftIsoDate(input.today, -28);
  const recentStart = shiftIsoDate(input.today, -2);
  const baselineEnd = shiftIsoDate(recentStart, -1);
  const baseline = filterByLocalDate(
    input.spend,
    baselineStart,
    baselineEnd,
    input.timezone,
  );
  const recent = filterByLocalDate(
    input.spend,
    recentStart,
    input.today,
    input.timezone,
  );
  let best:
    | { movement: Movement; median: number; ratio: number; baseline: Movement[] }
    | undefined;

  for (const movement of recent) {
    if (!movement.category_id) continue;
    const comparable = baseline.filter(
      (candidate) =>
        candidate.category_id === movement.category_id &&
        candidate.id !== movement.id &&
        candidate.amount > 0,
    );
    if (comparable.length < 6) continue;
    const median = medianAmount(comparable);
    if (median <= 0) continue;
    const ratio = movement.amount / median;
    if (ratio < 2 || movement.amount - median < 20) continue;
    if (!best || ratio > best.ratio) {
      best = { movement, median, ratio, baseline: comparable };
    }
  }
  if (!best) return null;

  const categoryId = best.movement.category_id as CategoryId;
  const label = categoryLabels[categoryId];
  const confidence = clamp(0.65 + Math.min(best.baseline.length, 12) * 0.018, 0, 0.92);
  return {
    type: "anomaly",
    fingerprint: `anomaly:${best.movement.id}`,
    periodStart: baselineStart,
    periodEnd: input.today,
    confidence,
    qualityScore: roundScore(58 + confidence * 30 + Math.min(best.ratio / 5, 1) * 8),
    rankScore: roundScore(60 + confidence * 24 + Math.min(best.ratio / 5, 1) * 12),
    riskLevel: categoryId === "salud" ? "sensitive" : "medium",
    title: `Un gasto en ${label} fue distinto a lo habitual`,
    body:
      "Lo marco para darte contexto, no para asumir que estuvo mal ni que volvera a ocurrir.",
    evidenceText: `${formatPen(best.movement.amount)} frente a una mediana de ${formatPen(best.median)}`,
    evidence: {
      period_start: baselineStart,
      period_end: input.today,
      category_id: categoryId,
      movement_id: best.movement.id,
      amount: roundMoney(best.movement.amount),
      baseline_median: roundMoney(best.median),
      baseline_movement_count: best.baseline.length,
      ratio: roundDecimal(best.ratio),
      exclusions: ["transferencias", "prestamos", "pendientes"],
    },
    sourceFacts: {
      category_id: categoryId,
      category_label: label,
      amount: roundMoney(best.movement.amount),
      baseline_median: roundMoney(best.median),
      baseline_movement_count: best.baseline.length,
    },
    sourceEntityIds: [
      best.movement.id,
      ...best.baseline.map((movement) => movement.id),
    ],
    action: {
      type: "view_movements",
      target_view: "movements",
      filters: { movement_id: best.movement.id },
    },
    expiresAt: addDays(input.now, 7).toISOString(),
    metadata: { signal_version: "insight-engine-v1" },
  };
}

function buildMerchantPatternInsight(input: {
  spend: Movement[];
  today: string;
  now: Date;
  timezone: string;
}): InsightDraft | null {
  const periodStart = shiftIsoDate(input.today, -59);
  const period = filterByLocalDate(
    input.spend,
    periodStart,
    input.today,
    input.timezone,
  ).filter((movement) => normalizeMerchant(movement.merchant) != null);
  const groups = new Map<string, Movement[]>();
  for (const movement of period) {
    const key = normalizeMerchant(movement.merchant);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), movement]);
  }
  const [merchantKey, selected] = [...groups.entries()]
    .filter(([, movements]) => movements.length >= 4)
    .sort((left, right) => right[1].length - left[1].length)[0] ?? [null, []];
  if (!merchantKey || selected.length < 4) return null;
  const merchant = selected[0].merchant?.trim() ?? merchantKey;
  const total = sumAmounts(selected);
  const lastOccurred = [...selected]
    .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at))[0]
    .occurred_at;

  return {
    type: "merchant_pattern",
    fingerprint: `merchant_pattern:${merchantKey}:60d`,
    periodStart,
    periodEnd: input.today,
    confidence: clamp(0.68 + selected.length * 0.03, 0, 0.92),
    qualityScore: roundScore(70 + selected.length * 2),
    rankScore: roundScore(68 + selected.length * 2),
    riskLevel: "low",
    title: `${merchant} se repitio en tus gastos`,
    body: `Aparece ${selected.length} veces en los ultimos 60 dias, por un total de ${formatPen(total)}.`,
    evidenceText: `${selected.length} movimientos por ${formatPen(total)}`,
    evidence: {
      merchant,
      merchant_key: merchantKey,
      period_start: periodStart,
      period_end: input.today,
      movement_count: selected.length,
      total_amount: roundMoney(total),
      exclusions: ["transferencias", "ajustes", "pendientes"],
    },
    sourceFacts: {
      merchant,
      movement_count: selected.length,
      total_amount: roundMoney(total),
    },
    sourceEntityIds: selected.map((movement) => movement.id),
    action: {
      type: "view_movements",
      target_view: "movements",
      filters: { merchant, date_from: periodStart, date_to: input.today },
    },
    expiresAt: addDays(new Date(lastOccurred), 30).toISOString(),
    metadata: { signal_version: "insight-engine-v3", class: "B" },
  };
}

function compareDebtPriority(left: Debt, right: Debt): number {
  const statusPriority: Record<Debt["status"], number> = {
    overdue: 0,
    due_soon: 1,
    active: 2,
    draft: 3,
    paid: 4,
    cancelled: 5,
    archived: 6,
  };
  const statusDifference = statusPriority[left.status] - statusPriority[right.status];
  if (statusDifference !== 0) return statusDifference;
  const leftDate = left.next_payment_date ?? left.due_date ?? "9999-12-31";
  const rightDate = right.next_payment_date ?? right.due_date ?? "9999-12-31";
  const dateDifference = leftDate.localeCompare(rightDate);
  if (dateDifference !== 0) return dateDifference;
  return Number(right.current_balance) - Number(left.current_balance);
}

function debtProgressRatio(debt: Debt): number {
  const principal = Number(debt.principal_amount);
  const remaining = Number(debt.current_balance);
  if (!Number.isFinite(principal) || principal <= 0) return 0;
  if (!Number.isFinite(remaining) || remaining < 0 || remaining >= principal) return 0;
  return clamp((principal - remaining) / principal, 0, 1);
}

function isInsightCurrency(value: string): value is InsightCurrency {
  return value === "PEN" || value === "USD";
}

function normalizeMerchant(value: string | null): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("es-PE");
  return normalized.length > 0 ? normalized : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function recordString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function recordNumber(
  record: Record<string, unknown>,
  key: string,
): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function recordCurrency(
  record: Record<string, unknown>,
  key: string,
): InsightCurrency | null {
  const value = recordString(record, key);
  return value && isInsightCurrency(value) ? value : null;
}

function recordStringArray(
  record: Record<string, unknown>,
  key: string,
): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function isConfirmedMovement(movement: Movement): boolean {
  return movement.status === "confirmed" && movement.deleted_at == null;
}

function filterByLocalDate(
  movements: Movement[],
  start: string,
  end: string,
  timezone: string,
): Movement[] {
  return movements.filter((movement) => {
    const date = localIsoDate(new Date(movement.occurred_at), timezone);
    return date >= start && date <= end;
  });
}

function groupAmountByCategory(movements: Movement[]): Map<CategoryId, number> {
  const totals = new Map<CategoryId, number>();
  for (const movement of movements) {
    if (!movement.category_id) continue;
    totals.set(
      movement.category_id,
      (totals.get(movement.category_id) ?? 0) + Number(movement.amount),
    );
  }
  return totals;
}

function sumAmounts(movements: Movement[]): number {
  return movements.reduce((sum, movement) => sum + Number(movement.amount), 0);
}

function medianAmount(movements: Movement[]): number {
  const values = movements.map((movement) => Number(movement.amount)).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

function hasMinimumSpan(
  movements: Movement[],
  days: number,
  timezone: string,
): boolean {
  const dates = movements
    .map((movement) => localIsoDate(new Date(movement.occurred_at), timezone))
    .sort();
  if (dates.length === 0) return false;
  return daysBetweenIsoDates(dates[0], dates[dates.length - 1]) >= days;
}

function minOccurredDate(movements: Movement[]): string | null {
  const values = movements.map((movement) => movement.occurred_at).sort();
  return values[0]?.slice(0, 10) ?? null;
}

function minLocalDate(movements: Movement[], timezone: string): string | null {
  const values = movements
    .map((movement) => localIsoDate(new Date(movement.occurred_at), timezone))
    .sort();
  return values[0] ?? null;
}

function localIsoDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function localWeekday(date: Date, timezone: string): number {
  const label = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  }).format(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(label);
}

function weekdayLabel(weekday: number): string {
  return [
    "domingos",
    "lunes",
    "martes",
    "miercoles",
    "jueves",
    "viernes",
    "sabados",
  ][weekday] ?? "dias similares";
}

function shiftIsoDate(value: string, days: number): string {
  const date = isoDateToUtc(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetweenIsoDates(from: string, to: string): number {
  return Math.round(
    (isoDateToUtc(to).getTime() - isoDateToUtc(from).getTime()) / 86_400_000,
  );
}

function isoDateToUtc(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function startOfNextWeek(date: Date): Date {
  const result = new Date(date);
  const daysUntilMonday = ((8 - result.getUTCDay()) % 7) || 7;
  result.setUTCDate(result.getUTCDate() + daysUntilMonday);
  result.setUTCHours(0, 0, 0, 0);
  return result;
}

function compareDrafts(left: InsightDraft, right: InsightDraft): number {
  if (right.rankScore !== left.rankScore) return right.rankScore - left.rankScore;
  if (right.qualityScore !== left.qualityScore) {
    return right.qualityScore - left.qualityScore;
  }
  return right.confidence - left.confidence;
}

function formatPen(value: number): string {
  return `S/${roundMoney(value).toFixed(2)}`;
}

function formatCurrency(value: number, currency: InsightCurrency): string {
  const prefix = currency === "PEN" ? "S/" : "US$";
  return `${prefix}${roundMoney(value).toFixed(2)}`;
}

function formatPercent(value: number): string {
  const percent = Math.round(value * 100);
  return `${percent > 0 ? "+" : ""}${percent}%`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundDecimal(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function roundScore(value: number): number {
  return Math.round(clamp(value, 0, 100));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
