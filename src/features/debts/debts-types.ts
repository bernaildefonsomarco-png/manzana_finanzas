import type {
  Account,
  Debt,
  DebtInstallment,
  DebtDirection,
  DebtKind,
  DebtPayment,
  DebtPaymentAllocation,
  DebtStatus,
  Movement,
  RelatedPerson,
} from "@/shared/types/domain";

export type DebtWithPerson = Debt & {
  related_person: RelatedPerson | null;
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

export type DebtsResponse = {
  debts: DebtWithPerson[];
};

export type DebtDetailResponse = {
  debt: DebtDetailWithPayments;
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

export type CreateDebtPayload = {
  direction: DebtDirection;
  kind: DebtKind;
  name: string;
  related_person_name?: string | null;
  principal_amount: number;
  currency?: "PEN" | "USD";
  opened_at?: string | null;
  due_date?: string | null;
  next_payment_date?: string | null;
  installment_count?: number | null;
  installment_amount?: number | null;
  interest_notes?: string | null;
};

export type CreateDebtPaymentPayload = {
  amount: number;
  account_id?: string | null;
  paid_at?: string;
  note?: string | null;
};

export type DebtPaymentResponse = {
  movement: Movement;
  debt: Debt;
  payment: DebtPayment;
  installment_allocations: DebtPaymentAllocation[];
  allocation_policy: "oldest_open_due_date_first_v1";
  idempotent: boolean;
};

export type DebtPaymentAccountsResponse = {
  accounts: Account[];
};

export type DebtSummary = {
  total_i_owe: number;
  total_they_owe_me: number;
  net_position: number;
  active_count: number;
  due_soon_count: number;
  overdue_count: number;
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
};

export type DebtPaymentHistoryItem = {
  id: string;
  movement_id: string | null;
  amount_label: string;
  paid_at: string;
  paid_label: string;
  type_label: string;
  source_label: string;
  movement_label: string;
  allocation_label: string;
};

export type DebtInstallmentViewItem = {
  id: string;
  number: number;
  due_date: string;
  due_label: string;
  expected_amount_label: string;
  paid_amount_label: string;
  pending_amount_label: string;
  status_label: string;
  status_tone: "neutral" | "success" | "warning" | "error" | "info" | "debt";
  movement_label: string;
  allocation_count: number;
};

export type DebtDetailViewModel = DebtViewItem & {
  opened_label: string;
  due_label: string | null;
  installment_label: string | null;
  schedule_expected_amount: number;
  schedule_paid_amount: number;
  schedule_pending_amount: number;
  schedule_balance_gap: number;
  schedule_warning: string | null;
  last_payment_label: string | null;
  history: DebtPaymentHistoryItem[];
  installments: DebtInstallmentViewItem[];
};
