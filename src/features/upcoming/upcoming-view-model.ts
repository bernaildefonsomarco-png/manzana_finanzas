import type {
  CategoryId,
  RecurringCandidate,
  RecurringAmountVariability,
  RecurringFrequency,
  RecurringOccurrence,
  RecurringOccurrenceStatus,
} from "@/shared/types/domain";
import {
  CATEGORY_IDS,
  RECURRING_AMOUNT_VARIABILITIES,
  RECURRING_FREQUENCIES,
} from "@/shared/types/domain";
import type {
  DebtInstallmentCommitment,
  DebtInstallmentViewItem,
  RecurringRuleWithOccurrences,
  RecurringDetailViewModel,
  UpcomingSummary,
  UpcomingViewItem,
} from "./upcoming-types";

const payableOccurrenceStatuses: RecurringOccurrenceStatus[] = [
  "expected",
  "due_soon",
  "pending_confirmation",
  "overdue",
];

export const frequencyLabels: Record<RecurringFrequency, string> = {
  weekly: "Cada semana",
  biweekly: "Cada dos semanas",
  monthly: "Cada mes",
  yearly: "Cada ano",
  custom_window: "Ventana mensual",
};

export const categoryLabels = {
  alimentacion: "Alimentacion",
  transporte: "Transporte",
  vivienda_hogar: "Vivienda / Hogar",
  servicios_suscripciones: "Servicios / Suscripciones",
  salud: "Salud",
  educacion: "Educacion",
  ocio_salidas: "Ocio / Salidas",
  compras_personales: "Compras personales",
  familia_apoyo: "Familia / Apoyo",
  deudas: "Deudas",
  trabajo_productividad: "Trabajo / Productividad",
  otros: "Otros",
} as const;

export type SuggestedCandidateViewModel = {
  id: string;
  title: string;
  evidence_label: string;
  amount: number | null;
  amount_label: string;
  currency: "PEN" | "USD";
  frequency: RecurringFrequency;
  frequency_label: string;
  amount_variability: RecurringAmountVariability;
  next_expected_date: string | null;
  next_label: string;
  category_id: CategoryId | null;
  category_label: string | null;
  confidence_label: string;
};

export function summarizeUpcoming(input: {
  rules: RecurringRuleWithOccurrences[];
  candidates: RecurringCandidate[];
  debt_installments?: DebtInstallmentCommitment[];
  today?: Date;
}): UpcomingSummary {
  const debtInstallments = input.debt_installments ?? [];
  const visibleRules = filterRulesCoveredByDebtInstallments(
    input.rules,
    debtInstallments
  );
  const items = visibleRules.flatMap((rule) => toUpcomingViewItems(rule, input.today));
  const debtItems = debtInstallments.map((installment) =>
    toDebtInstallmentViewItem(installment, input.today)
  );

  return {
    active_count:
      items.filter((item) => item.group === "active").length +
      debtItems.filter((item) => !item.is_overdue).length,
    overdue_count:
      items.filter((item) => item.group === "overdue").length +
      debtItems.filter((item) => item.is_overdue).length,
    paused_count: items.filter((item) => item.group === "paused").length,
    suggested_count: input.candidates.length + items.filter((item) => item.group === "suggested").length,
    monthly_estimate: roundMoney(
      visibleRules
        .filter((rule) => rule.status === "active")
        .reduce((sum, rule) => sum + monthlyEquivalent(rule), 0) +
        debtInstallments.reduce(
          (sum, installment) => sum + installment.amount,
          0
        )
    ),
  };
}

export function filterRulesCoveredByDebtInstallments(
  rules: RecurringRuleWithOccurrences[],
  debtInstallments: DebtInstallmentCommitment[]
): RecurringRuleWithOccurrences[] {
  const visibleDebtIds = new Set(
    debtInstallments.map((installment) => installment.debt_id)
  );

  return rules.filter(
    (rule) => !rule.linked_debt_id || !visibleDebtIds.has(rule.linked_debt_id)
  );
}

export function toDebtInstallmentViewItem(
  installment: DebtInstallmentCommitment,
  today = new Date(),
  canRegisterPayment = false
): DebtInstallmentViewItem {
  const isOverdue =
    startOfDay(installment.due_at).getTime() < startOfToday(today).getTime();

  return {
    id: installment.id,
    debt_id: installment.debt_id,
    installment_id: installment.installment_id,
    title: installment.title,
    amount: installment.amount,
    currency: installment.currency,
    direction: installment.direction,
    due_at: installment.due_at,
    due_label: formatDueLabel(installment.due_at, today),
    status_label: isOverdue ? "Vencida" : "Proxima",
    status_tone: isOverdue ? "warning" : "info",
    is_overdue: isOverdue,
    can_register_payment: canRegisterPayment,
    payment_action_label:
      installment.direction === "i_owe"
        ? "Registrar pago"
        : "Registrar cobro",
  };
}

export function toDebtInstallmentViewItems(
  installments: DebtInstallmentCommitment[],
  today = new Date()
): DebtInstallmentViewItem[] {
  const seenDebtIds = new Set<string>();

  return installments
    .slice()
    .sort((left, right) => {
      const dueComparison = left.due_at.localeCompare(right.due_at);
      return dueComparison !== 0 ? dueComparison : left.id.localeCompare(right.id);
    })
    .map((installment) => {
      const canRegisterPayment = !seenDebtIds.has(installment.debt_id);
      seenDebtIds.add(installment.debt_id);
      return toDebtInstallmentViewItem(
        installment,
        today,
        canRegisterPayment
      );
    });
}

export function toSuggestedCandidateViewModel(
  candidate: RecurringCandidate,
  today = new Date()
): SuggestedCandidateViewModel {
  const evidence = asRecord(candidate.evidence);
  const title =
    getString(evidence, "display_name") ?? toDisplayName(candidate.merchant_key);
  const amount = getNumber(evidence, "inferred_amount");
  const currency = asCurrency(getString(evidence, "currency")) ?? "PEN";
  const frequency =
    asFrequency(getString(evidence, "inferred_frequency")) ?? "monthly";
  const amountVariability =
    asAmountVariability(getString(evidence, "amount_variability")) ?? "estimated";
  const nextExpectedDate = getIsoDate(evidence, "next_expected_date");
  const categoryId =
    asCategory(getString(evidence, "category_id")) ?? candidate.category_id;
  const movementCount = getNumber(evidence, "movement_count");

  return {
    id: candidate.id,
    title,
    evidence_label: movementCount
      ? `${movementCount} movimientos detectados`
      : "Patron detectado",
    amount,
    amount_label: amount ? formatUpcomingMoney(amount, currency) : "Monto por revisar",
    currency,
    frequency,
    frequency_label: frequencyLabels[frequency],
    amount_variability: amountVariability,
    next_expected_date: nextExpectedDate,
    next_label: nextExpectedDate
      ? formatDueLabel(nextExpectedDate, today)
      : "Fecha por revisar",
    category_id: categoryId,
    category_label: categoryId ? categoryLabels[categoryId] : null,
    confidence_label:
      candidate.confidence >= 0.9
        ? "Coincidencia sólida"
        : candidate.confidence >= 0.75
          ? "Conviene revisar"
          : "Necesita confirmación",
  };
}

export function toUpcomingViewItems(
  rule: RecurringRuleWithOccurrences,
  today = new Date()
): UpcomingViewItem[] {
  const paidItems = rule.occurrences
    .filter((occurrence) => occurrence.status === "paid")
    .sort((left, right) => right.expected_date.localeCompare(left.expected_date))
    .slice(0, 2)
    .map((occurrence) => toUpcomingViewItem(rule, today, occurrence));
  const nextOpen = pickNextOpenOccurrence(rule.occurrences);
  const nextItem = toUpcomingViewItem(rule, today, nextOpen);

  return [...paidItems, nextItem];
}

export function toUpcomingViewItem(
  rule: RecurringRuleWithOccurrences,
  today = new Date(),
  occurrenceOverride?: RecurringOccurrence | null
): UpcomingViewItem {
  const occurrence = occurrenceOverride ?? pickNextOpenOccurrence(rule.occurrences);
  const dueAt = occurrence?.expected_date ?? rule.next_expected_date;
  const amount = occurrence?.expected_amount ?? rule.expected_amount ?? 0;
  const isPaid = occurrence?.status === "paid";
  const dueDate = dueAt ? startOfDay(dueAt) : null;
  const todayDate = startOfToday(today);
  const isFuture = !isPaid && Boolean(dueDate) && dueDate!.getTime() > todayDate.getTime();
  const isOverdue =
    !isPaid &&
    rule.status === "active" &&
    Boolean(dueAt) &&
    dueDate!.getTime() < todayDate.getTime();
  const group =
    isPaid
      ? "paid"
      : rule.status === "suggested"
      ? "suggested"
      : rule.status === "paused"
      ? "paused"
      : isOverdue
      ? "overdue"
      : "active";

  return {
    id: rule.id,
    occurrence_id: occurrence?.id ?? null,
    title: rule.name,
    amount: roundMoney(Number(amount)),
    currency: rule.currency,
    frequency: rule.frequency,
    cadence_label: frequencyLabels[rule.frequency],
    due_at: dueAt,
    due_label: isPaid ? formatPaidLabel(occurrence?.paid_at ?? dueAt, today) : formatDueLabel(dueAt, today),
    is_future: isFuture,
    status: rule.status,
    group,
    status_label: getStatusLabel(rule.status, isOverdue, isPaid),
    status_tone: getStatusTone(rule.status, isOverdue, isPaid),
    category_id: rule.category_id,
    account_id: rule.default_account_id,
    can_mark_paid:
      !isPaid &&
      rule.status === "active" &&
      !rule.linked_debt_id &&
      Boolean(occurrence?.id),
    payment_action_label: getPaymentActionLabel(isPaid, isFuture),
    rule,
  };
}

export function groupUpcomingItems(items: UpcomingViewItem[]) {
  return {
    overdue: items.filter((item) => item.group === "overdue"),
    paid: items.filter((item) => item.group === "paid"),
    active: items.filter((item) => item.group === "active"),
    paused: items.filter((item) => item.group === "paused"),
    suggested: items.filter((item) => item.group === "suggested"),
  };
}

export function toRecurringDetailViewModel(
  rule: RecurringRuleWithOccurrences,
  today = new Date()
): RecurringDetailViewModel {
  const nextItem = toUpcomingViewItem(rule, today);
  const paidOccurrences = rule.occurrences
    .filter((occurrence) => occurrence.status === "paid")
    .sort((left, right) => right.expected_date.localeCompare(left.expected_date));
  const lastPaid = paidOccurrences[0] ?? null;
  const timeline = rule.occurrences
    .slice()
    .sort(compareOccurrencesForTimeline)
    .map((occurrence) => {
      const paidLabel =
        occurrence.status === "paid"
          ? formatPaidLabel(occurrence.paid_at ?? occurrence.expected_date, today)
          : null;

      return {
        id: occurrence.id,
        expected_date: occurrence.expected_date,
        date_label: formatDueLabel(occurrence.expected_date, today),
        amount_label: formatUpcomingMoney(
          Number(occurrence.expected_amount ?? rule.expected_amount ?? 0),
          rule.currency
        ),
        status: occurrence.status,
        status_label: getOccurrenceStatusLabel(occurrence.status),
        status_tone: getOccurrenceStatusTone(occurrence.status),
        paid_label: paidLabel,
        paid_movement_id: occurrence.paid_movement_id,
        can_mark_paid:
          rule.status === "active" &&
          !rule.linked_debt_id &&
          payableOccurrenceStatuses.includes(occurrence.status),
      };
    });

  return {
    id: rule.id,
    title: rule.name,
    amount_label: formatUpcomingMoney(Number(rule.expected_amount ?? 0), rule.currency),
    cadence_label: frequencyLabels[rule.frequency],
    status_label: nextItem.status_label,
    status_tone: nextItem.status_tone,
    category_label: rule.category_id ? categoryLabels[rule.category_id] : null,
    account_id: rule.default_account_id,
    next_due_label: nextItem.due_label,
    next_due_at: nextItem.due_at,
    last_paid_label: lastPaid
      ? formatPaidLabel(lastPaid.paid_at ?? lastPaid.expected_date, today)
      : null,
    linked_debt: Boolean(rule.linked_debt_id),
    timeline,
  };
}

export function formatUpcomingMoney(
  amount: number,
  currency: "PEN" | "USD" = "PEN"
): string {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol} ${amount.toLocaleString("es-PE", {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function monthlyEquivalent(rule: RecurringRuleWithOccurrences): number {
  const amount = Number(rule.expected_amount ?? 0);

  if (rule.frequency === "weekly") return amount * 4.33;
  if (rule.frequency === "biweekly") return amount * 2.17;
  if (rule.frequency === "yearly") return amount / 12;
  return amount;
}

function getStatusLabel(status: string, isOverdue: boolean, isPaid: boolean): string {
  if (isPaid) return "Pagado";
  if (isOverdue) return "Vencido";
  if (status === "active") return "Activo";
  if (status === "paused") return "Pausado";
  if (status === "suggested") return "Sugerido";
  return "Cerrado";
}

function getStatusTone(status: string, isOverdue: boolean, isPaid: boolean) {
  if (isPaid) return "success" as const;
  if (isOverdue) return "warning" as const;
  if (status === "active") return "success" as const;
  if (status === "paused") return "neutral" as const;
  if (status === "suggested") return "info" as const;
  return "neutral" as const;
}

function getPaymentActionLabel(isPaid: boolean, isFuture: boolean): string {
  if (isPaid) return "Pagado";
  if (isFuture) return "Pagar adelantado";
  return "Marcar pagado";
}

function formatPaidLabel(value: string | null, today: Date): string {
  if (!value) return "Pagado";

  const date = value.includes("T") ? new Date(value) : startOfDay(value);
  if (Number.isNaN(date.getTime())) return "Pagado";

  const diffDays = Math.round(
    (startOfToday(today).getTime() -
      new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()) /
      86_400_000
  );

  if (diffDays === 0) return "Pagado hoy";
  if (diffDays === 1) return "Pagado ayer";

  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function pickNextOpenOccurrence(
  occurrences: RecurringOccurrence[]
): RecurringOccurrence | null {
  return (
    occurrences
      .filter((occurrence) => payableOccurrenceStatuses.includes(occurrence.status))
      .sort((left, right) => left.expected_date.localeCompare(right.expected_date))[0] ??
    null
  );
}

function compareOccurrencesForTimeline(
  left: RecurringOccurrence,
  right: RecurringOccurrence
): number {
  if (left.status === "paid" && right.status !== "paid") return 1;
  if (left.status !== "paid" && right.status === "paid") return -1;
  if (left.status === "paid" && right.status === "paid") {
    return right.expected_date.localeCompare(left.expected_date);
  }
  return left.expected_date.localeCompare(right.expected_date);
}

function getOccurrenceStatusLabel(status: RecurringOccurrenceStatus): string {
  if (status === "paid") return "Pagado";
  if (status === "overdue") return "Vencido";
  if (status === "due_soon") return "Por vencer";
  if (status === "pending_confirmation") return "Por confirmar";
  if (status === "skipped") return "Saltado";
  if (status === "rejected") return "Rechazado";
  return "Esperado";
}

function getOccurrenceStatusTone(status: RecurringOccurrenceStatus) {
  if (status === "paid") return "success" as const;
  if (status === "overdue") return "warning" as const;
  if (status === "rejected") return "error" as const;
  if (status === "due_soon" || status === "pending_confirmation") {
    return "info" as const;
  }
  return "neutral" as const;
}

function formatDueLabel(value: string | null, today: Date): string {
  if (!value) return "Sin fecha proxima";

  const date = startOfDay(value);
  const diffDays = Math.round(
    (date.getTime() - startOfToday(today).getTime()) / 86_400_000
  );

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Manana";
  if (diffDays === -1) return "Ayer";
  if (diffDays < -1) return `Hace ${Math.abs(diffDays)} dias`;
  if (diffDays < 7) return `En ${diffDays} dias`;

  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function startOfDay(value: string): Date {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return new Date(0);
  return date;
}

function startOfToday(today: Date): Date {
  return new Date(today.getFullYear(), today.getMonth(), today.getDate());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getIsoDate(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = getString(record, key);
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function asCurrency(value: string | null): "PEN" | "USD" | null {
  return value === "PEN" || value === "USD" ? value : null;
}

function asFrequency(value: string | null): RecurringFrequency | null {
  return value && RECURRING_FREQUENCIES.includes(value as RecurringFrequency)
    ? (value as RecurringFrequency)
    : null;
}

function asAmountVariability(
  value: string | null
): RecurringAmountVariability | null {
  return value &&
    RECURRING_AMOUNT_VARIABILITIES.includes(
      value as RecurringAmountVariability
    )
    ? (value as RecurringAmountVariability)
    : null;
}

function asCategory(value: string | null): CategoryId | null {
  return value && CATEGORY_IDS.includes(value as CategoryId)
    ? (value as CategoryId)
    : null;
}

function toDisplayName(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
