import type {
  CategoryId,
  RecurringAmountVariability,
  RecurringCandidate,
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
  RecurringHistoryViewItem,
  RecurringRuleWithOccurrences,
  SuggestedCandidateViewModel,
  UpcomingApiResponse,
  UpcomingCommitment,
  UpcomingSections,
  UpcomingStatusTone,
  UpcomingSummary,
  UpcomingViewItem,
} from "./upcoming-types";

const openStatuses: RecurringOccurrenceStatus[] = [
  "expected",
  "due_soon",
  "pending_confirmation",
  "overdue",
];

export const frequencyLabels: Record<RecurringFrequency, string> = {
  weekly: "Cada semana",
  biweekly: "Cada 14 días",
  monthly: "Cada mes",
  yearly: "Cada año",
  custom_window: "Ventana mensual",
};

export const amountVariabilityLabels: Record<
  RecurringAmountVariability,
  string
> = {
  fixed: "Monto fijo",
  estimated: "Monto estimado",
  variable: "Monto variable",
};

export const categoryLabels: Record<CategoryId, string> = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  vivienda_hogar: "Vivienda y hogar",
  servicios_suscripciones: "Servicios y suscripciones",
  salud: "Salud",
  educacion: "Educación",
  ocio_salidas: "Ocio y salidas",
  compras_personales: "Compras personales",
  familia_apoyo: "Familia y apoyo",
  deudas: "Deudas",
  trabajo_productividad: "Trabajo y productividad",
  otros: "Otros",
};

export type UpcomingViewModel = {
  sections: UpcomingSections;
  summary: UpcomingSummary;
  candidates: SuggestedCandidateViewModel[];
  calendar_items: UpcomingViewItem[];
  has_commitments: boolean;
  has_only_suggestions: boolean;
};

export function buildUpcomingViewModel(
  data: UpcomingApiResponse,
  todayIso: string
): UpcomingViewModel {
  const rulesById = new Map(
    data.recurring_rules.map((rule) => [rule.id, rule])
  );
  const commitments = data.commitments
    .filter(
      (commitment) =>
        commitment.kind !== "debt" || commitment.direction !== "they_owe_me"
    )
    .map((commitment) =>
      toUpcomingViewItem(commitment, rulesById, todayIso)
    );
  const commitmentRuleIds = new Set(
    commitments
      .map((item) => item.recurring_rule_id)
      .filter((id): id is string => Boolean(id))
  );
  const unpriced = data.recurring_rules
    .filter(
      (rule) =>
        rule.status === "active" &&
        !rule.linked_debt_id &&
        !commitmentRuleIds.has(rule.id) &&
        Boolean(rule.next_expected_date) &&
        differenceInDays(rule.next_expected_date ?? todayIso, todayIso) <=
          data.horizon_days
    )
    .map((rule) => toRuleFallbackViewItem(rule, todayIso));
  const paused = data.recurring_rules
    .filter(
      (rule) => rule.status === "paused" && !commitmentRuleIds.has(rule.id)
    )
    .map((rule) => toPausedViewItem(rule, todayIso));
  const financialItems = [...commitments, ...unpriced];
  const allItems = [...financialItems, ...paused].sort(compareItems);
  const sections: UpcomingSections = {
    this_week: allItems.filter((item) => item.section === "this_week"),
    later: allItems.filter((item) => item.section === "later"),
    pending: allItems.filter((item) => item.section === "pending"),
  };
  const monthPrefix = todayIso.slice(0, 7);
  const monthCommitments = financialItems.filter((item) =>
    item.due_at.startsWith(monthPrefix)
  );
  const summary: UpcomingSummary = {
    month_totals: {
      PEN: sumCurrency(monthCommitments, "PEN"),
      USD: sumCurrency(monthCommitments, "USD"),
    },
    month_count: monthCommitments.length,
    linked_box_count: financialItems.filter((item) => item.linked_box_id).length,
    pending_count: sections.pending.length,
    month_items: monthCommitments,
  };
  const candidates = data.candidates
    .map((candidate) => toSuggestedCandidateViewModel(candidate, todayIso))
    .sort((left, right) => left.title.localeCompare(right.title, "es"));

  return {
    sections,
    summary,
    candidates,
    calendar_items: allItems,
    has_commitments: allItems.length > 0,
    has_only_suggestions: allItems.length === 0 && candidates.length > 0,
  };
}

export function toSuggestedCandidateViewModel(
  candidate: RecurringCandidate,
  todayIso: string
): SuggestedCandidateViewModel {
  const evidence = asRecord(candidate.evidence);
  const title =
    getString(evidence, "display_name") ??
    toDisplayName(candidate.merchant_key);
  const amount = getNumber(evidence, "inferred_amount");
  const currency = asCurrency(getString(evidence, "currency")) ?? "PEN";
  const frequency =
    asFrequency(getString(evidence, "inferred_frequency")) ?? "monthly";
  const amountVariability =
    asAmountVariability(getString(evidence, "amount_variability")) ??
    "estimated";
  const nextExpectedDate = getIsoDate(evidence, "next_expected_date");
  const categoryId =
    asCategory(getString(evidence, "category_id")) ?? candidate.category_id;

  return {
    id: candidate.id,
    title,
    discreet_title: "Sugerencia de pago",
    evidence_label: buildEvidenceLabel(evidence, currency),
    amount,
    currency,
    amount_label:
      amount === null ? "Monto por revisar" : formatUpcomingMoney(amount, currency),
    frequency,
    frequency_label: frequencyLabels[frequency],
    amount_variability: amountVariability,
    next_expected_date: nextExpectedDate,
    next_label: nextExpectedDate
      ? formatDueLabel(nextExpectedDate, todayIso)
      : "Fecha por revisar",
    category_id: categoryId,
  };
}

export function toRecurringHistoryView(
  occurrences: RecurringOccurrence[],
  rule: RecurringRuleWithOccurrences,
  todayIso: string
): RecurringHistoryViewItem[] {
  return occurrences
    .slice()
    .sort((left, right) =>
      right.expected_date.localeCompare(left.expected_date)
    )
    .map((occurrence) => ({
      id: occurrence.id,
      expected_date: occurrence.expected_date,
      date_label: formatDueLabel(occurrence.expected_date, todayIso),
      amount: occurrence.expected_amount ?? rule.expected_amount,
      status: occurrence.status,
      status_label: occurrenceStatusLabel(occurrence.status),
      status_tone: occurrenceStatusTone(occurrence.status),
      paid_at: occurrence.paid_at,
      paid_movement_id: occurrence.paid_movement_id,
    }));
}

export function formatUpcomingMoney(
  amount: number,
  currency: "PEN" | "USD" = "PEN"
): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace(/^S\/\s*/, "S/")
    .replace(/^(?:US\$|USD)\s*/, "$");
}

export function formatFullDate(value: string): string {
  const date = parseIsoDate(value);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function toUpcomingViewItem(
  commitment: UpcomingCommitment,
  rulesById: Map<string, RecurringRuleWithOccurrences>,
  todayIso: string
): UpcomingViewItem {
  const rule = commitment.recurring_rule_id
    ? rulesById.get(commitment.recurring_rule_id) ?? null
    : null;
  const timing = commitmentTiming(commitment, rule, todayIso);
  const section =
    timing.state !== "upcoming"
      ? "pending"
      : differenceInDays(commitment.due_at, todayIso) <= 7
        ? "this_week"
        : "later";
  const recurring = commitment.kind === "recurring";

  return {
    key: `${commitment.kind}:${commitment.id}`,
    id: commitment.id,
    title: commitment.title,
    discreet_title:
      section === "pending"
        ? "Tienes un compromiso pendiente"
        : "Tienes un compromiso próximo",
    amount:
      typeof commitment.amount === "number"
        ? roundMoney(commitment.amount)
        : null,
    currency: commitment.currency,
    due_at: commitment.due_at,
    due_label: formatDueLabel(commitment.due_at, todayIso),
    section,
    status_label: timing.label,
    status_tone: timing.tone,
    alert: timing.alert,
    kind: commitment.kind,
    linked_box_id: commitment.linked_box_id,
    linked_box_label: commitment.linked_box_id
      ? "Vinculado a una caja"
      : null,
    recurring_rule_id: commitment.recurring_rule_id ?? null,
    occurrence_id: commitment.occurrence_id ?? null,
    debt_id: commitment.debt_id ?? null,
    installment_id: commitment.installment_id ?? null,
    debt_kind: commitment.debt_kind,
    date_is_approximate: commitment.date_is_approximate,
    informal_agreement: commitment.informal_agreement,
    can_mark_paid:
      recurring &&
      rule?.status === "active" &&
      Boolean(commitment.occurrence_id),
    can_skip:
      recurring &&
      rule?.status === "active" &&
      Boolean(commitment.occurrence_id),
    can_pause: recurring && rule?.status === "active",
    can_resume: recurring && rule?.status === "paused",
    rule,
  };
}

function toRuleFallbackViewItem(
  rule: RecurringRuleWithOccurrences,
  todayIso: string
): UpcomingViewItem {
  const occurrence = pickOpenOccurrence(rule.occurrences);
  const dueAt = occurrence?.expected_date ?? rule.next_expected_date ?? todayIso;
  const amount = occurrence?.expected_amount ?? rule.expected_amount;
  const timing = commitmentTiming(
    {
      id: occurrence?.id ?? rule.id,
      title: rule.name,
      amount,
      currency: rule.currency,
      due_at: dueAt,
      kind: "recurring",
      linked_box_id: rule.linked_box_id,
      recurring_rule_id: rule.id,
      occurrence_id: occurrence?.id ?? null,
    },
    rule,
    todayIso
  );
  const section =
    timing.state !== "upcoming"
      ? "pending"
      : differenceInDays(dueAt, todayIso) <= 7
        ? "this_week"
        : "later";

  return {
    key: `rule-fallback:${rule.id}:${dueAt}`,
    id: occurrence?.id ?? rule.id,
    title: rule.name,
    discreet_title:
      section === "pending"
        ? "Tienes un compromiso pendiente"
        : "Tienes un compromiso próximo",
    amount: typeof amount === "number" ? roundMoney(amount) : null,
    currency: rule.currency,
    due_at: dueAt,
    due_label: formatDueLabel(dueAt, todayIso),
    section,
    status_label:
      amount === null && timing.state === "upcoming"
        ? "Monto por revisar"
        : timing.label,
    status_tone: timing.tone,
    alert: timing.alert,
    kind: "recurring",
    linked_box_id: rule.linked_box_id,
    linked_box_label: rule.linked_box_id ? "Vinculado a una caja" : null,
    recurring_rule_id: rule.id,
    occurrence_id: occurrence?.id ?? null,
    debt_id: null,
    installment_id: null,
    can_mark_paid: Boolean(occurrence),
    can_skip: Boolean(occurrence),
    can_pause: true,
    can_resume: false,
    rule,
  };
}

function toPausedViewItem(
  rule: RecurringRuleWithOccurrences,
  todayIso: string
): UpcomingViewItem {
  const occurrence = pickOpenOccurrence(rule.occurrences);
  const dueAt = occurrence?.expected_date ?? rule.next_expected_date ?? todayIso;
  return {
    key: `paused:${rule.id}`,
    id: rule.id,
    title: rule.name,
    discreet_title: "Tienes un pago pausado",
    amount: roundMoney(
      Number(occurrence?.expected_amount ?? rule.expected_amount ?? 0)
    ),
    currency: rule.currency,
    due_at: dueAt,
    due_label: formatDueLabel(dueAt, todayIso),
    section: "later",
    status_label: "Pausado",
    status_tone: "neutral",
    alert: false,
    kind: "recurring",
    linked_box_id: rule.linked_box_id,
    linked_box_label: rule.linked_box_id ? "Vinculado a una caja" : null,
    recurring_rule_id: rule.id,
    occurrence_id: occurrence?.id ?? null,
    debt_id: null,
    installment_id: null,
    can_mark_paid: false,
    can_skip: false,
    can_pause: false,
    can_resume: true,
    rule,
  };
}

function commitmentTiming(
  commitment: UpcomingCommitment,
  rule: RecurringRuleWithOccurrences | null,
  todayIso: string
): {
  state: "upcoming" | "pending" | "overdue";
  label: string;
  tone: UpcomingStatusTone;
  alert: boolean;
} {
  const daysLate = differenceInDays(todayIso, commitment.due_at);
  if (daysLate < 0) {
    return {
      state: "upcoming",
      label: "Próximo",
      tone: commitment.kind === "debt" ? "debt" : "info",
      alert: false,
    };
  }

  if (commitment.kind === "debt") {
    const approximate =
      !commitment.debt_kind ||
      commitment.debt_kind === "personal" ||
      commitment.date_is_approximate === true ||
      commitment.informal_agreement === true;
    const explicitlyOverdue =
      commitment.presentation_state === "overdue" || daysLate >= 3;
    if (explicitlyOverdue && !approximate) {
      return {
        state: "overdue",
        label: "Vencido",
        tone: "warning",
        alert: true,
      };
    }
    return {
      state: "pending",
      label: "Pendiente",
      tone: "warning",
      alert: false,
    };
  }

  const approximate =
    getBoolean(asRecord(rule?.metadata), "date_is_approximate") ||
    getBoolean(asRecord(rule?.metadata), "informal_agreement");
  const explicitlyOverdue =
    commitment.presentation_state === "overdue" ||
    (!commitment.presentation_state && daysLate >= 3);
  if (explicitlyOverdue && !approximate) {
    return {
      state: "overdue",
      label: "Vencido",
      tone: "warning",
      alert: true,
    };
  }

  return {
    state: "pending",
    label: "Pendiente",
    tone: "warning",
    alert: false,
  };
}

function buildEvidenceLabel(
  evidence: Record<string, unknown>,
  currency: "PEN" | "USD"
): string {
  const dates = getStringArray(evidence, "dates").slice(-3);
  const amounts = getNumberArray(evidence, "amounts").slice(-3);
  const movementCount = getNumber(evidence, "movement_count");
  const datePart =
    dates.length > 0
      ? `Lo vi ${joinNatural(
          dates.map((date) => formatEvidenceDate(date))
        )}.`
      : movementCount
        ? `Lo vi en ${movementCount} movimientos confirmados.`
        : "Hay movimientos confirmados que se repiten.";
  if (amounts.length === 0) return datePart;

  const uniqueAmounts = [...new Set(amounts.map(roundMoney))];
  const amountPart =
    uniqueAmounts.length === 1
      ? ` El monto fue ${formatUpcomingMoney(uniqueAmounts[0], currency)} cada vez.`
      : ` Los montos fueron ${joinNatural(
          amounts.map((amount) => formatUpcomingMoney(amount, currency))
        )}.`;
  return `${datePart}${amountPart}`;
}

function formatEvidenceDate(value: string): string {
  const date = parseIsoDate(value);
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace(".", "");
}

function formatDueLabel(value: string, todayIso: string): string {
  const difference = differenceInDays(value, todayIso);
  if (difference === 0) return "Hoy";
  if (difference === 1) return "Mañana";
  if (difference === -1) return "Ayer";
  if (difference > 1 && difference <= 7) return `En ${difference} días`;
  if (difference < -1) return `Hace ${Math.abs(difference)} días`;
  return formatFullDate(value);
}

function occurrenceStatusLabel(status: RecurringOccurrenceStatus): string {
  if (status === "paid") return "Pagado";
  if (status === "skipped") return "Saltado";
  if (status === "overdue") return "Vencido";
  if (status === "pending_confirmation") return "Pendiente";
  if (status === "due_soon") return "Próximo";
  if (status === "rejected") return "Rechazado";
  return "Esperado";
}

function occurrenceStatusTone(
  status: RecurringOccurrenceStatus
): UpcomingStatusTone {
  if (status === "paid") return "success";
  if (status === "overdue" || status === "pending_confirmation") {
    return "warning";
  }
  if (status === "rejected") return "error";
  if (status === "due_soon") return "info";
  return "neutral";
}

function pickOpenOccurrence(
  occurrences: RecurringOccurrence[]
): RecurringOccurrence | null {
  return (
    occurrences
      .filter((occurrence) => openStatuses.includes(occurrence.status))
      .sort((left, right) =>
        left.expected_date.localeCompare(right.expected_date)
      )[0] ?? null
  );
}

function compareItems(left: UpcomingViewItem, right: UpcomingViewItem) {
  const byDate = left.due_at.localeCompare(right.due_at);
  return byDate === 0 ? left.key.localeCompare(right.key) : byDate;
}

function parseIsoDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(0);
  return new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  );
}

function differenceInDays(left: string, right: string): number {
  return Math.round(
    (parseIsoDate(left).getTime() - parseIsoDate(right).getTime()) /
      86_400_000
  );
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

function getBoolean(record: Record<string, unknown>, key: string): boolean {
  return record[key] === true;
}

function getStringArray(
  record: Record<string, unknown>,
  key: string
): string[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function getNumberArray(
  record: Record<string, unknown>,
  key: string
): number[] {
  const value = record[key];
  return Array.isArray(value)
    ? value.filter(
        (item): item is number =>
          typeof item === "number" && Number.isFinite(item)
      )
    : [];
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

function joinNatural(values: string[]): string {
  if (values.length <= 1) return values[0] ?? "";
  return `${values.slice(0, -1).join(", ")} y ${values.at(-1)}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function sumCurrency(
  items: UpcomingViewItem[],
  currency: "PEN" | "USD"
): number {
  return roundMoney(
    items.reduce(
      (sum, item) =>
        item.currency === currency && typeof item.amount === "number"
          ? sum + item.amount
          : sum,
      0
    )
  );
}
