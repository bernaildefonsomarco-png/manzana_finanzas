import type {
  Account,
  CategoryId,
  DebtDirection,
  DebtKind,
  Movement,
  RecurringAmountVariability,
  RecurringCandidate,
  RecurringFrequency,
  RecurringOccurrence,
  RecurringOccurrenceStatus,
  RecurringRule,
} from "@/shared/types/domain";

export type RecurringRuleWithOccurrences = RecurringRule & {
  occurrences: RecurringOccurrence[];
};

export type UpcomingCommitment = {
  id: string;
  title: string;
  amount: number | null;
  currency: "PEN" | "USD";
  due_at: string;
  kind: "recurring" | "debt";
  linked_box_id: string | null;
  linked_debt_id?: string | null;
  recurring_rule_id?: string;
  occurrence_id?: string | null;
  presentation_state?: "upcoming" | "pending_confirmation" | "overdue";
  presentation_label?: "Próximo" | "Pago pendiente" | "Vencido";
  days_late?: number;
  direction?: DebtDirection;
  debt_id?: string;
  debt_name?: string;
  installment_id?: string;
  installment_number?: number;
  debt_kind?: DebtKind;
  date_is_approximate?: boolean;
  informal_agreement?: boolean;
};

export type UpcomingApiResponse = {
  commitments: UpcomingCommitment[];
  recurring_rules: RecurringRuleWithOccurrences[];
  candidates: RecurringCandidate[];
  horizon_days: number;
  timezone: "America/Lima";
};

export type RecurringAccountsResponse = {
  accounts: Account[];
};

export type CreateRecurringPayload = {
  name: string;
  expected_amount: number | null;
  amount_variability: RecurringAmountVariability;
  currency: "PEN" | "USD";
  frequency: RecurringFrequency;
  next_expected_date: string;
  category_id?: CategoryId | null;
  default_account_id?: string | null;
};

export type UpdateRecurringPayload = Partial<
  Omit<CreateRecurringPayload, "currency">
>;

export type ConfirmRecurringCandidatePayload = Partial<CreateRecurringPayload>;

export type MarkRecurringPaidPayload = {
  amount: number;
  account_id?: string | null;
  paid_at?: string;
  note?: string | null;
};

export type MarkRecurringPaidResponse = {
  movement: Movement;
  recurring_rule: RecurringRule;
  occurrence: RecurringOccurrence;
  idempotent: boolean;
};

export type RecurringOccurrencesResponse = {
  occurrences: RecurringOccurrence[];
};

export type UpcomingSectionKey =
  | "this_week"
  | "later"
  | "pending";

export type UpcomingStatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "debt";

export type UpcomingViewItem = {
  key: string;
  id: string;
  title: string;
  discreet_title: string;
  amount: number | null;
  currency: "PEN" | "USD";
  due_at: string;
  due_label: string;
  section: UpcomingSectionKey;
  status_label: string;
  status_tone: UpcomingStatusTone;
  alert: boolean;
  kind: "recurring" | "debt";
  linked_box_id: string | null;
  linked_box_label: string | null;
  recurring_rule_id: string | null;
  occurrence_id: string | null;
  debt_id: string | null;
  installment_id: string | null;
  debt_kind?: DebtKind;
  date_is_approximate?: boolean;
  informal_agreement?: boolean;
  can_mark_paid: boolean;
  can_skip: boolean;
  can_pause: boolean;
  can_resume: boolean;
  rule: RecurringRuleWithOccurrences | null;
};

export type UpcomingSections = Record<
  UpcomingSectionKey,
  UpcomingViewItem[]
>;

export type UpcomingSummary = {
  month_totals: Record<"PEN" | "USD", number>;
  month_count: number;
  linked_box_count: number;
  pending_count: number;
  /** `48` `RUL-AYUDA-01` — las filas exactas que suman `month_totals`, sin
   * recalcular el filtro de mes en la procedencia. */
  month_items: UpcomingViewItem[];
};

export type SuggestedCandidateViewModel = {
  id: string;
  title: string;
  discreet_title: string;
  evidence_label: string;
  amount: number | null;
  currency: "PEN" | "USD";
  amount_label: string;
  frequency: RecurringFrequency;
  frequency_label: string;
  amount_variability: RecurringAmountVariability;
  next_expected_date: string | null;
  next_label: string;
  category_id: CategoryId | null;
};

export type RecurringHistoryViewItem = {
  id: string;
  expected_date: string;
  date_label: string;
  amount: number | null;
  status: RecurringOccurrenceStatus;
  status_label: string;
  status_tone: UpcomingStatusTone;
  paid_at: string | null;
  paid_movement_id: string | null;
};
