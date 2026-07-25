import type {
  DebtDirection,
  NudgeType,
  RecurringOccurrence,
  RecurringOccurrenceStatus,
  RecurringRule,
  RiskLevel,
} from "@/shared/types/domain";

export type NudgeEvaluationRule = RecurringRule & {
  occurrences: RecurringOccurrence[];
};

export type DashboardNudgeDraft = {
  type: NudgeType;
  sourceEntityType:
    | "recurring_occurrence"
    | "debt_installment"
    | "pending_batch"
    | "lifecycle_daily"
    | "lifecycle_weekly"
    | "lifecycle_inactivity";
  sourceEntityId: string;
  priority: number;
  riskLevel: RiskLevel;
  scheduledFor: string;
  metadata: Record<string, unknown>;
};

export type LifecycleNudgeSignals = {
  userId: string;
  movementCountToday: number;
  movementCountLast7Days: number;
  pendingCount: number;
  emailPendingCount: number;
  backfillPendingCount: number;
  oldestPendingId: string | null;
  lastActivityAt: string | null;
  lastUserMessageAt: string | null;
  sourceIds: {
    daily: string;
    weekly: string;
    inactivity: string;
  };
};

export type DebtInstallmentNudgeInput = {
  id: string;
  debt_id: string;
  debt_name: string;
  installment_number: number;
  amount: number;
  currency: "PEN" | "USD";
  direction: DebtDirection;
  due_date: string;
};

const payableOccurrenceStatuses: RecurringOccurrenceStatus[] = [
  "expected",
  "due_soon",
  "pending_confirmation",
  "overdue",
];

export function buildRecurringDashboardNudgeDrafts(input: {
  rules: NudgeEvaluationRule[];
  now?: Date;
  horizonDays?: number;
  timezone?: string;
}): DashboardNudgeDraft[] {
  const now = input.now ?? new Date();
  const horizonDays = clampInteger(input.horizonDays ?? 3, 1, 14);
  const timezone = input.timezone ?? "America/Lima";
  const today = localIsoDate(now, timezone);
  const scheduledFor = now.toISOString();
  const drafts: DashboardNudgeDraft[] = [];

  for (const rule of input.rules) {
    if (rule.status !== "active") continue;
    if (rule.linked_debt_id) continue;

    for (const occurrence of rule.occurrences) {
      if (!payableOccurrenceStatuses.includes(occurrence.status)) continue;

      const daysUntilDue = daysBetweenDates(today, occurrence.expected_date);
      if (daysUntilDue > horizonDays) continue;

      const overdue = daysUntilDue < 0 || occurrence.status === "overdue";
      const type: NudgeType = overdue ? "overdue_payment" : "payment_due";
      const absoluteDays = Math.abs(daysUntilDue);
      const priority = overdue
        ? Math.min(100, 88 + Math.min(absoluteDays, 12))
        : Math.max(62, 78 - Math.max(daysUntilDue, 0) * 4);
      const amount = occurrence.expected_amount ?? rule.expected_amount;

      drafts.push({
        type,
        sourceEntityType: "recurring_occurrence",
        sourceEntityId: occurrence.id,
        priority,
        riskLevel: overdue ? "medium" : "low",
        scheduledFor,
        metadata: {
          nudge_version: "dashboard-nudges-v1",
          channel: "dashboard",
          source: "recurring_occurrence",
          recurring_rule_id: rule.id,
          recurring_rule_name: rule.name,
          occurrence_id: occurrence.id,
          due_date: occurrence.expected_date,
          days_until_due: daysUntilDue,
          amount: typeof amount === "number" ? roundMoney(amount) : null,
          currency: rule.currency,
          title: overdue
            ? `${rule.name} quedo pendiente`
            : `${rule.name} vence pronto`,
          body: overdue
            ? "Sigue abierto en tus pagos esperados. Puedes revisarlo sin registrar nada nuevo."
            : "Aparece cerca en tus pagos esperados. Conviene tenerlo a la vista.",
          evidence:
            daysUntilDue === 0
              ? "Vence hoy"
              : overdue
              ? `Hace ${absoluteDays} dia${absoluteDays === 1 ? "" : "s"}`
              : `En ${daysUntilDue} dia${daysUntilDue === 1 ? "" : "s"}`,
          action_label: overdue ? "Revisar pago" : "Ver pago",
          target_view: "upcoming",
        },
      });
    }
  }

  return drafts.sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return String(left.metadata.due_date).localeCompare(String(right.metadata.due_date));
  });
}

export function buildDebtDashboardNudgeDrafts(input: {
  installments: DebtInstallmentNudgeInput[];
  now?: Date;
  horizonDays?: number;
  timezone?: string;
}): DashboardNudgeDraft[] {
  const now = input.now ?? new Date();
  const horizonDays = clampInteger(input.horizonDays ?? 3, 1, 14);
  const timezone = input.timezone ?? "America/Lima";
  const today = localIsoDate(now, timezone);
  const scheduledFor = now.toISOString();
  const seenDebts = new Set<string>();
  const drafts: DashboardNudgeDraft[] = [];
  const installments = [...input.installments].sort((left, right) => {
    const byDate = left.due_date.localeCompare(right.due_date);
    if (byDate !== 0) return byDate;
    return left.installment_number - right.installment_number;
  });

  for (const installment of installments) {
    if (seenDebts.has(installment.debt_id)) continue;
    if (!Number.isFinite(installment.amount) || installment.amount <= 0) continue;

    const daysUntilDue = daysBetweenDates(today, installment.due_date);
    if (daysUntilDue > horizonDays) continue;

    seenDebts.add(installment.debt_id);
    const overdue = daysUntilDue < 0;
    const absoluteDays = Math.abs(daysUntilDue);
    const isCollection = installment.direction === "they_owe_me";

    drafts.push({
      type: "debt_due",
      sourceEntityType: "debt_installment",
      sourceEntityId: installment.id,
      priority: overdue
        ? Math.min(100, 92 + Math.min(absoluteDays, 8))
        : Math.max(70, 84 - Math.max(daysUntilDue, 0) * 4),
      riskLevel: "sensitive",
      scheduledFor,
      metadata: {
        nudge_version: "dashboard-debt-due-v1",
        channel: "dashboard",
        source: "debt_installment",
        debt_id: installment.debt_id,
        debt_name: installment.debt_name,
        installment_id: installment.id,
        installment_number: installment.installment_number,
        direction: installment.direction,
        due_date: installment.due_date,
        days_until_due: daysUntilDue,
        amount: roundMoney(installment.amount),
        currency: installment.currency,
        title: overdue
          ? isCollection
            ? "Hay un cobro pendiente"
            : "Una cuota sigue pendiente"
          : isCollection
            ? "Tienes un cobro proximo"
            : "Tienes una cuota proxima",
        body: isCollection
          ? "Puedes revisar el cobro y registrar lo recibido cuando ocurra."
          : "Puedes revisar la cuota y registrar el pago cuando ocurra.",
        evidence:
          daysUntilDue === 0
            ? "Es hoy"
            : overdue
              ? `Hace ${absoluteDays} dia${absoluteDays === 1 ? "" : "s"}`
              : daysUntilDue === 1
                ? "Es manana"
                : `En ${daysUntilDue} dias`,
        action_label: isCollection ? "Ver cobro" : "Ver cuota",
        target_view: "debts",
      },
    });
  }

  return drafts.sort((left, right) => {
    if (right.priority !== left.priority) return right.priority - left.priority;
    return String(left.metadata.due_date).localeCompare(String(right.metadata.due_date));
  });
}

/**
 * Genera candidatos de lifecycle desde hechos confirmados. No decide enviar:
 * consentimiento, horario, frecuencia, riesgo y disclosure se evalúan después.
 */
export function buildLifecycleNudgeDrafts(input: {
  signals: LifecycleNudgeSignals;
  now?: Date;
  timezone?: string;
}): DashboardNudgeDraft[] {
  const now = input.now ?? new Date();
  const timezone = input.timezone ?? "America/Lima";
  const signals = input.signals;
  const scheduledFor = now.toISOString();
  const today = localIsoDate(now, timezone);
  const localHour = localHourOfDay(now, timezone);
  const lastActivityAt = latestIsoTimestamp(
    signals.lastActivityAt,
    signals.lastUserMessageAt,
  );
  const inactivityDays = lastActivityAt
    ? completedDaysBetween(lastActivityAt, now)
    : null;
  const userMessagedToday = signals.lastUserMessageAt
    ? localIsoDate(new Date(signals.lastUserMessageAt), timezone) === today
    : false;
  const drafts: DashboardNudgeDraft[] = [];

  if (signals.pendingCount >= 2 && signals.oldestPendingId) {
    drafts.push({
      type: "pending_review",
      sourceEntityType: "pending_batch",
      sourceEntityId: signals.oldestPendingId,
      priority: signals.emailPendingCount > 0 ? 88 : 84,
      riskLevel: "medium",
      scheduledFor,
      metadata: {
        nudge_version: "lifecycle-v1",
        channel: "dashboard",
        source: "pending_inbox",
        pending_count: signals.pendingCount,
        email_pending_count: signals.emailPendingCount,
        backfill_pending_count: signals.backfillPendingCount,
        delivery_channel:
          signals.backfillPendingCount > 0
            ? "dashboard_only"
            : "policy_controlled",
        minimum_pending_count: 2,
        title: "Tienes movimientos por revisar",
        body: `Hay ${signals.pendingCount} pendientes separados hasta que los confirmes.`,
        evidence: "Nada pendiente afecta tus saldos.",
        action_label: "Revisar juntos",
        target_view: "pending",
      },
    });
  }

  if (signals.movementCountLast7Days >= 5) {
    drafts.push({
      type: "weekly_review",
      sourceEntityType: "lifecycle_weekly",
      sourceEntityId: signals.sourceIds.weekly,
      priority: 64,
      riskLevel: "low",
      scheduledFor,
      metadata: {
        nudge_version: "lifecycle-v1",
        channel: "dashboard",
        source: "scheduler",
        period_key: isoWeekKey(now, timezone),
        timezone,
        movement_count: signals.movementCountLast7Days,
        pending_count: signals.pendingCount,
        minimum_movement_count: 5,
        title: "Tu semana ya tiene forma",
        body: `Registraste ${signals.movementCountLast7Days} movimientos en los ultimos 7 dias.`,
        evidence:
          signals.pendingCount > 0
            ? `Tambien hay ${signals.pendingCount} pendiente${signals.pendingCount === 1 ? "" : "s"} por revisar.`
            : "No tienes pendientes abiertos.",
        action_label: "Ver semana",
        target_view: "movements",
      },
    });
  }

  const dailyReconstructionEligible =
    localHour >= 19 &&
    localHour < 22 &&
    signals.movementCountLast7Days > 0 &&
    signals.movementCountToday < 2 &&
    signals.pendingCount === 0 &&
    !userMessagedToday;
  if (dailyReconstructionEligible) {
    drafts.push({
      type: "daily_reconstruction",
      sourceEntityType: "lifecycle_daily",
      sourceEntityId: signals.sourceIds.daily,
      priority: 60,
      riskLevel: "low",
      scheduledFor,
      metadata: {
        nudge_version: "lifecycle-v1",
        channel: "dashboard",
        source: "scheduler",
        local_date: today,
        timezone,
        movement_count_today: signals.movementCountToday,
        movement_count_last_7_days: signals.movementCountLast7Days,
        title: "¿Quieres completar tu dia?",
        body: "Si se te paso algo, puedes anotarlo como lo recuerdes.",
        evidence: "Solo si te sirve; no necesitas reconstruir todo.",
        action_label: "Registrar algo",
        target_view: "movements",
      },
    });
  }

  if (inactivityDays !== null && inactivityDays >= 2) {
    const dormant = inactivityDays >= 15;
    const atRisk = inactivityDays >= 7 && inactivityDays < 15;
    const type: NudgeType = atRisk || dormant ? "reengagement" : "missing_activity";
    drafts.push({
      type,
      sourceEntityType: "lifecycle_inactivity",
      sourceEntityId: signals.sourceIds.inactivity,
      priority: atRisk ? 60 : dormant ? 45 : 42,
      riskLevel: "low",
      scheduledFor,
      metadata: {
        nudge_version: "lifecycle-v1",
        channel: "dashboard",
        source: "scheduler",
        lifecycle_state: atRisk ? "at_risk" : dormant ? "dormant" : "quiet",
        timezone,
        inactivity_days: inactivityDays,
        last_activity_at: lastActivityAt,
        title: dormant ? "Manzana sigue aqui" : "Puedes retomar por una sola cosa",
        body:
          signals.pendingCount > 0
            ? "Tienes pendientes separados. Si prefieres, los revisamos juntos."
            : "Cuando quieras, podemos reconstruir algo rapido y sin culpa.",
        evidence: "No tienes que ponerte al dia con todo.",
        action_label: signals.pendingCount > 0 ? "Ver pendientes" : "Retomar",
        target_view: signals.pendingCount > 0 ? "pending" : "home",
      },
    });
  }

  return drafts.sort((left, right) => right.priority - left.priority);
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

function localHourOfDay(date: Date, timezone: string): number {
  const value = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hourCycle: "h23",
  }).format(date);
  return Number(value);
}

function completedDaysBetween(from: string, to: Date): number {
  const fromTime = new Date(from).getTime();
  if (!Number.isFinite(fromTime)) return 0;
  return Math.max(0, Math.floor((to.getTime() - fromTime) / 86_400_000));
}

function latestIsoTimestamp(...values: Array<string | null>): string | null {
  const valid = values
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ value, time: new Date(value).getTime() }))
    .filter((entry) => Number.isFinite(entry.time))
    .sort((left, right) => right.time - left.time);
  return valid[0]?.value ?? null;
}

function isoWeekKey(date: Date, timezone: string): string {
  const localDate = localIsoDate(date, timezone);
  const value = new Date(`${localDate}T00:00:00.000Z`);
  const day = value.getUTCDay() || 7;
  value.setUTCDate(value.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((value.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${value.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function daysBetweenDates(fromIsoDate: string, toIsoDate: string): number {
  const fromMs = isoDateToUtcMs(fromIsoDate);
  const toMs = isoDateToUtcMs(toIsoDate);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function isoDateToUtcMs(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
