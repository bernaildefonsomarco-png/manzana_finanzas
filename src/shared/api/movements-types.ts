import type { Debt, DebtInstallment, Movement, MovementAuditLog } from "@/shared/types/domain";

export type ListMovementsFilters = {
  type?: string;
  status?: string;
  category_id?: string;
  account_id?: string;
  from?: string;
  to?: string;
  q?: string;
  include_deleted?: boolean;
  cursor?: string;
  limit?: number;
};

export type ListMovementsResponse = {
  movements: Movement[];
};

export type DuplicateWarning = {
  reason: "cross_channel_duplicate";
  requires_confirmation: boolean;
  dedup_status: string;
  matched_movement_id: string | null;
  score: number | null;
};

export type CreateGenericMovementPayload = {
  type:
    | "gasto"
    | "ingreso"
    | "transferencia"
    | "asignacion_interna"
    | "ajuste"
    | "pago_recurrente";
  amount: number;
  currency?: "PEN" | "USD";
  occurred_at: string;
  description?: string | null;
  merchant?: string | null;
  category_id?: string | null;
  subcategory_id?: string | null;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
  box_origin_id?: string | null;
  box_destination_id?: string | null;
  recurring_rule_id?: string | null;
  related_person_id?: string | null;
  tag_ids?: string[];
  metadata?: Record<string, unknown>;
  confirm_duplicate?: boolean;
};

export type CreateDebtOriginationPayload = {
  type: "deuda_adquirida" | "prestamo_dado" | "prestamo_recibido";
  amount: number;
  currency?: "PEN" | "USD";
  occurred_at: string;
  description?: string | null;
  related_person_name: string;
  account_id?: string | null;
  installment_count?: number | null;
  first_due_date?: string | null;
  installment_amount?: number | null;
  interest_notes?: string | null;
};

export type CreateDebtPaymentPayload = {
  type: "pago_deuda" | "devolucion_recibida";
  debt_id: string;
  amount: number;
  currency?: "PEN" | "USD" | null;
  occurred_at: string;
  description?: string | null;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
};

export type CreateMovementResult = {
  type: "movement_created";
  movement: Movement;
  idempotent: boolean;
};

export type CreateDebtOriginationResult = {
  debt: Debt;
  installments: DebtInstallment[];
  movement: Movement | null;
  idempotent: boolean;
};

export type CreateDebtPaymentResult = {
  movement: Movement;
  debt: Debt;
  idempotent: boolean;
};

export type MovementHistoryResponse = {
  history: MovementAuditLog[];
};
