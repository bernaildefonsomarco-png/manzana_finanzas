import type {
  Account,
  CategoryId,
  DebtDirection,
  Movement,
  RecurringAmountVariability,
  RecurringCandidate,
  RecurringFrequency,
  RecurringOccurrence,
  RecurringOccurrenceStatus,
  RecurringRule,
  RecurringStatus,
} from "@/shared/types/domain";

export type RecurringRuleWithOccurrences = RecurringRule & {
  occurrences: RecurringOccurrence[];
};

export type DebtInstallmentCommitment = {
  id: string;
  title: string;
  amount: number;
  currency: "PEN" | "USD";
  direction: DebtDirection;
  due_at: string;
  kind: "debt";
  linked_box_id: null;
  debt_id: string;
  installment_id: string;
};

export type UpcomingDashboardResponse = {
  rules: RecurringRuleWithOccurrences[];
  candidates: RecurringCandidate[];
  debt_installments: DebtInstallmentCommitment[];
};

export type CreateRecurringPayload = {
  name: string;
  expected_amount: number;
  amount_variability: RecurringAmountVariability;
  currency: "PEN" | "USD";
  frequency: RecurringFrequency;
  next_expected_date: string;
  category_id?: CategoryId | null;
  default_account_id?: string | null;
};

export type UpdateRecurringPayload = Partial<CreateRecurringPayload> & {
  status?: Extract<RecurringStatus, "active" | "paused">;
};

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

export type RecurringRuleResponse = {
  recurring_rule: RecurringRuleWithOccurrences;
};

export type DetectRecurringCandidatesPayload = {
  lookback_days?: number;
  limit?: number;
};

export type DetectRecurringCandidatesResponse = {
  result: {
    detected: number;
    ready_to_suggest: number;
    inserted: number;
    updated: number;
    stored: number;
    candidates: RecurringCandidate[];
  };
};

export type ConfirmRecurringCandidatePayload = Partial<CreateRecurringPayload>;

export type ConfirmRecurringCandidateResponse = {
  candidate: RecurringCandidate;
  recurring_rule: RecurringRuleWithOccurrences;
};

export type DiscardRecurringCandidateResponse = {
  candidate: RecurringCandidate;
};

export type RecurringAccountsResponse = {
  accounts: Account[];
};

export type UpcomingSummary = {
  active_count: number;
  overdue_count: number;
  paused_count: number;
  suggested_count: number;
  monthly_estimate: number;
};

export type DebtInstallmentViewItem = {
  id: string;
  debt_id: string;
  installment_id: string;
  title: string;
  amount: number;
  currency: "PEN" | "USD";
  direction: DebtDirection;
  due_at: string;
  due_label: string;
  status_label: "Proxima" | "Vencida";
  status_tone: "info" | "warning";
  is_overdue: boolean;
  can_register_payment: boolean;
  payment_action_label: "Registrar pago" | "Registrar cobro";
};

export type UpcomingViewItem = {
  id: string;
  occurrence_id: string | null;
  title: string;
  amount: number;
  currency: "PEN" | "USD";
  frequency: RecurringFrequency;
  cadence_label: string;
  due_at: string | null;
  due_label: string;
  is_future: boolean;
  status: RecurringStatus;
  group: "active" | "overdue" | "paid" | "paused" | "suggested";
  status_label: string;
  status_tone: "neutral" | "success" | "warning" | "error" | "info" | "debt";
  category_id: CategoryId | null;
  account_id: string | null;
  can_mark_paid: boolean;
  payment_action_label: string;
  rule: RecurringRuleWithOccurrences;
};

export type RecurringDetailOccurrenceView = {
  id: string;
  expected_date: string;
  date_label: string;
  amount_label: string;
  status: RecurringOccurrenceStatus;
  status_label: string;
  status_tone: "neutral" | "success" | "warning" | "error" | "info" | "debt";
  paid_label: string | null;
  paid_movement_id: string | null;
  can_mark_paid: boolean;
};

export type RecurringDetailViewModel = {
  id: string;
  title: string;
  amount_label: string;
  cadence_label: string;
  status_label: string;
  status_tone: "neutral" | "success" | "warning" | "error" | "info" | "debt";
  category_label: string | null;
  account_id: string | null;
  next_due_label: string;
  next_due_at: string | null;
  last_paid_label: string | null;
  linked_debt: boolean;
  timeline: RecurringDetailOccurrenceView[];
};
