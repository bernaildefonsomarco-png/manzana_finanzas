import type {
  Account,
  Box,
  Debt,
  DebtDirection,
  DebtInstallment,
  DebtKind,
  DebtPayment,
  DebtPaymentAllocation,
  DebtStatus,
  InstallmentStatus,
  Movement,
  RelatedPerson,
} from "@/shared/types/domain";

export type DebtWithPerson = Debt & {
  related_person: RelatedPerson | null;
  linked_box?: Box | null;
};

export type DebtPaymentWithMovement = DebtPayment & {
  movement: Movement | null;
  allocations: DebtPaymentAllocation[];
};

export type DebtInstallmentWithMovement = DebtInstallment & {
  movement: Movement | null;
  allocations: DebtPaymentAllocation[];
};

export type DebtDetailWithPayments = DebtWithPerson & {
  payments: DebtPaymentWithMovement[];
  installments: DebtInstallmentWithMovement[];
};

export type DebtScreenIntent = {
  debtId: string;
  installmentId?: string | null;
  action: "detail" | "pay";
};

export type DebtInstallmentPaymentTarget = {
  installment_id: string;
  installment_number: number;
  amount: number;
};

export type DebtsResponse = { debts: DebtWithPerson[] };
export type DebtDetailResponse = { debt: DebtDetailWithPayments };
export type DebtPaymentAccountsResponse = { accounts: Account[] };

export type CreateDebtPayload = {
  direction: DebtDirection;
  kind: DebtKind;
  name: string;
  related_person_name?: string | null;
  principal_amount: number;
  currency: "PEN";
  opened_at?: string | null;
  due_date?: string | null;
  next_payment_date?: string | null;
  installment_count?: number | null;
  installment_amount?: number | null;
  interest_notes?: string | null;
  account_id?: string | null;
};

export type UpdateDebtPayload = {
  name?: string;
  kind?: DebtKind;
  due_date?: string | null;
  interest_notes?: string | null;
};

export type CreateDebtPaymentPayload = {
  amount: number;
  account_id?: string | null;
  paid_at?: string;
  note?: string | null;
};

export type DebtPaymentPreviewAllocation = {
  installment_id: string;
  installment_number: number;
  due_date: string;
  previous_paid_amount: number;
  allocated_amount: number;
  projected_paid_amount: number;
  projected_status: InstallmentStatus;
};

export type DebtPaymentPreview = {
  amount: number;
  previous_balance: number;
  projected_balance: number;
  allocations: DebtPaymentPreviewAllocation[];
  unallocated_amount: number;
  allocation_policy: "oldest_open_due_date_first_v1";
};

export type DebtPaymentResponse = {
  movement: Movement;
  debt: Debt;
  payment: DebtPayment;
  installment_allocations: DebtPaymentAllocation[];
  allocation_policy: "oldest_open_due_date_first_v1";
  idempotent: boolean;
};

export type DebtSummary = {
  total_i_owe: number;
  total_they_owe_me: number;
  total_i_owe_usd: number;
  total_they_owe_me_usd: number;
  active_i_owe: number;
  active_they_owe_me: number;
  closed_count: number;
};

export type DebtViewItem = {
  id: string;
  title: string;
  person_label: string | null;
  direction: DebtDirection;
  direction_label: string;
  kind_label: string;
  status: DebtStatus;
  status_label: string;
  status_tone: "neutral" | "success" | "warning" | "error" | "info" | "debt";
  principal_amount: number;
  current_balance: number;
  paid_amount: number;
  currency: "PEN" | "USD";
  progress: number;
  next_date_label: string | null;
  linked_box_name: string | null;
  linked_box_balance: number | null;
  is_closed: boolean;
};

export type DebtPaymentHistoryItem = {
  id: string;
  movement_id: string | null;
  amount_label: string;
  paid_label: string;
  type_label: string;
  source_label: string;
  movement_label: string;
  allocation_lines: string[];
  is_reversed: boolean;
  reversal_reason: string | null;
};

export type DebtInstallmentViewItem = {
  id: string;
  number: number;
  due_date: string;
  due_label: string;
  expected_amount: number;
  paid_amount: number;
  pending_amount: number;
  expected_amount_label: string;
  paid_amount_label: string;
  pending_amount_label: string;
  status: InstallmentStatus;
  status_label: string;
  status_tone: "neutral" | "success" | "warning" | "error" | "info" | "debt";
  allocation_count: number;
  is_open: boolean;
};

export type DebtDetailViewModel = DebtViewItem & {
  opened_label: string;
  due_label: string | null;
  schedule_pending_amount: number;
  schedule_balance_gap: number;
  schedule_warning: string | null;
  last_payment_label: string | null;
  history: DebtPaymentHistoryItem[];
  installments: DebtInstallmentViewItem[];
};

export type InstallmentSchedulePreview = {
  number: number;
  due_date: string;
  amount: number;
};
