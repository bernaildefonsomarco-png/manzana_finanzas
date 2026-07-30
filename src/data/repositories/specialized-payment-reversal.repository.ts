import type { SupabaseClient } from "@supabase/supabase-js";

import { CoreError } from "@/core/finance/errors";
import type { Database, Json } from "@/data/supabase/types";
import type {
  Debt,
  DebtPayment,
  Movement,
  RecurringOccurrence,
  RecurringRule,
} from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

export type SpecializedReversalMode = "soft_delete" | "reverse";

export type DebtPaymentReversalResult = {
  movement: Movement;
  debt: Debt;
  payment: DebtPayment;
  idempotent: boolean;
};

export type RecurringPaymentReversalResult = {
  movement: Movement;
  recurring_rule: RecurringRule;
  occurrence: RecurringOccurrence;
  idempotent: boolean;
};

export async function reverseDebtPayment(
  client: Client,
  input: {
    userId: string;
    movementId: string;
    reason: string;
    mode: SpecializedReversalMode;
    traceId: string;
  }
): Promise<DebtPaymentReversalResult> {
  const { data, error } = await client.rpc("reverse_debt_payment", {
    p_user_id: input.userId,
    p_movement_id: input.movementId,
    p_reason: input.reason,
    p_mode: input.mode,
    p_trace_id: input.traceId,
  });
  if (error) throw mapSpecializedReversalError(error);
  if (!isDebtReversalResult(data)) {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "El Core devolvio una reversion de deuda invalida."
    );
  }
  return data;
}

export async function reverseRecurringPayment(
  client: Client,
  input: {
    userId: string;
    movementId: string;
    reason: string;
    mode: SpecializedReversalMode;
    traceId: string;
  }
): Promise<RecurringPaymentReversalResult> {
  const { data, error } = await client.rpc("reverse_recurring_payment", {
    p_user_id: input.userId,
    p_movement_id: input.movementId,
    p_reason: input.reason,
    p_mode: input.mode,
    p_trace_id: input.traceId,
  });
  if (error) throw mapSpecializedReversalError(error);
  if (!isRecurringReversalResult(data)) {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "El Core devolvio una reversion recurrente invalida."
    );
  }
  return data;
}

function isDebtReversalResult(value: Json): value is Json & DebtPaymentReversalResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "movement" in value &&
      "debt" in value &&
      "payment" in value &&
      "idempotent" in value &&
      typeof value.idempotent === "boolean"
  );
}

function isRecurringReversalResult(
  value: Json
): value is Json & RecurringPaymentReversalResult {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      "movement" in value &&
      "recurring_rule" in value &&
      "occurrence" in value &&
      "idempotent" in value &&
      typeof value.idempotent === "boolean"
  );
}

function mapSpecializedReversalError(error: unknown): unknown {
  const message = getErrorMessage(error);
  if (message.includes("MOVEMENT_NOT_FOUND")) {
    return new CoreError("MOVEMENT_NOT_FOUND", "Movimiento no encontrado.");
  }
  if (
    message.includes("SPECIALIZED_REVERSAL_REASON_REQUIRED") ||
    message.includes("SPECIALIZED_REVERSAL_MODE_INVALID")
  ) {
    return new CoreError(
      "CORE_REPOSITORY_ERROR",
      "La reversion necesita un motivo y modo validos."
    );
  }
  if (
    message.includes("ALREADY_REVERSED") ||
    message.includes("INCONSISTENT_STATE") ||
    message.includes("NOT_PAID_BY_MOVEMENT")
  ) {
    return new CoreError(
      "MOVEMENT_ALREADY_INACTIVE",
      "Ese pago ya fue revertido o no esta activo."
    );
  }
  if (message.includes("DEBT_REVERSAL_CLOSED_DEBT_REOPEN_REQUIRED")) {
    return new CoreError(
      "DEBT_REVERSAL_CLOSED_DEBT_REOPEN_REQUIRED",
      "Reabre primero la deuda condonada antes de revertir este pago."
    );
  }
  return error;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "";
}
