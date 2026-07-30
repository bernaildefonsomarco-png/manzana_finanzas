import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveDebt } from "@/core/debts/debt-payment-command";
import { getAccountById } from "@/data/repositories/accounts.repository";
import { getDebtById } from "@/data/repositories/debts.repository";
import {
  getRecurringOccurrenceById,
  getRecurringRuleById,
} from "@/data/repositories/recurring.repository";
import type { Database } from "@/data/supabase/types";
import type { PendingItem } from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

export type ConfirmabilityInput = {
  client: Client;
  userId: string;
  proposedAction: Record<string, unknown>;
  normalizedSummary: PendingItem["normalized_summary"];
};

export type ConfirmabilityResult = {
  confirmable: boolean;
  confirmCommand: Record<string, unknown> | null;
  /** RUL-PEND-01/AC-PEND-15: por que no es confirmable todavia, en espanol. */
  missingFields: string[];
};

/**
 * RUL-PEND-01: "todo pendiente nace confirmable o no nace". Replica, como
 * verificacion previa sin ejecutar nada, las mismas comprobaciones que
 * `confirm-pending.ts` hace al confirmar de verdad — para que la UI sepa
 * antes de mostrar el boton, no despues de que el usuario lo pulse.
 */
export async function computeConfirmability(
  input: ConfirmabilityInput
): Promise<ConfirmabilityResult> {
  const action = readString(input.proposedAction.action) ?? "create_movement";

  if (action === "review_specialized") {
    return notConfirmable(["tipo_de_movimiento"]);
  }
  if (action === "record_debt_payment") {
    return computeDebtPaymentConfirmability(input);
  }
  if (action === "record_recurring_payment") {
    return computeRecurringPaymentConfirmability(input);
  }
  if (action === "record_transfer") {
    return computeTransferConfirmability(input);
  }
  return computeGenericMovementConfirmability(input);
}

async function computeGenericMovementConfirmability(
  input: ConfirmabilityInput
): Promise<ConfirmabilityResult> {
  const summary = input.normalizedSummary;
  const missing: string[] = [];
  if (!summary.title?.trim()) missing.push("nombre");
  if (typeof summary.amount !== "number" || !Number.isFinite(summary.amount)) {
    missing.push("monto");
  }
  if (!summary.category_id) missing.push("categoria");
  if (missing.length > 0) return notConfirmable(missing);

  const accountId = readUuid(
    (input.proposedAction.movement_input as { account_origin_id?: unknown } | undefined)
      ?.account_origin_id ??
      (input.proposedAction.movement_input as { account_destination_id?: unknown } | undefined)
        ?.account_destination_id
  );
  if (accountId) {
    const account = await getAccountById(input.client, input.userId, accountId);
    if (!account) return notConfirmable(["cuenta"]);
  }

  return confirmable({ command: "create_movement" });
}

async function computeTransferConfirmability(
  input: ConfirmabilityInput
): Promise<ConfirmabilityResult> {
  const action = input.proposedAction;
  const originId = readUuid(action.account_origin_id);
  const destinationId = readUuid(action.account_destination_id);
  const summary = input.normalizedSummary;
  const missing: string[] = [];
  if (!originId) missing.push("cuenta_origen");
  if (!destinationId) missing.push("cuenta_destino");
  if (!summary.title?.trim()) missing.push("nombre");
  if (typeof summary.amount !== "number" || !Number.isFinite(summary.amount) || summary.amount <= 0) {
    missing.push("monto");
  }
  if (missing.length > 0) return notConfirmable(missing);
  if (originId === destinationId) return notConfirmable(["cuenta_origen"]);

  const [origin, destination] = await Promise.all([
    getAccountById(input.client, input.userId, originId as string),
    getAccountById(input.client, input.userId, destinationId as string),
  ]);
  if (!origin || !destination) return notConfirmable(["cuenta"]);
  const currency = summary.currency ?? "PEN";
  if (origin.currency !== currency || destination.currency !== currency) {
    return notConfirmable(["moneda"]);
  }

  return confirmable({ command: "record_transfer" });
}

async function computeRecurringPaymentConfirmability(
  input: ConfirmabilityInput
): Promise<ConfirmabilityResult> {
  const action = input.proposedAction;
  const ruleId = readUuid(action.recurring_rule_id);
  const occurrenceId = readUuid(action.recurring_occurrence_id);
  const summary = input.normalizedSummary;
  const missing: string[] = [];
  if (!ruleId) missing.push("recurrente");
  if (!occurrenceId) missing.push("ocurrencia");
  if (typeof summary.amount !== "number" || !Number.isFinite(summary.amount) || summary.amount <= 0) {
    missing.push("monto");
  }
  if (missing.length > 0) return notConfirmable(missing);

  const [rule, occurrence] = await Promise.all([
    getRecurringRuleById(input.client, input.userId, ruleId as string),
    getRecurringOccurrenceById(input.client, input.userId, occurrenceId as string),
  ]);
  if (!rule || rule.status !== "active" || rule.linked_debt_id) {
    return notConfirmable(["recurrente"]);
  }
  if (
    !occurrence ||
    occurrence.recurring_rule_id !== rule.id ||
    ["paid", "skipped", "rejected"].includes(occurrence.status)
  ) {
    return notConfirmable(["ocurrencia"]);
  }
  const accountId = readUuid(action.account_id);
  if (accountId) {
    const account = await getAccountById(input.client, input.userId, accountId);
    if (!account || account.currency !== rule.currency) return notConfirmable(["cuenta"]);
  }

  return confirmable({ command: "record_recurring_payment" });
}

async function computeDebtPaymentConfirmability(
  input: ConfirmabilityInput
): Promise<ConfirmabilityResult> {
  const action = input.proposedAction;
  const debtId = readUuid(action.debt_id);
  const summary = input.normalizedSummary;
  const missing: string[] = [];
  if (!debtId) missing.push("deuda");
  if (typeof summary.amount !== "number" || !Number.isFinite(summary.amount) || summary.amount <= 0) {
    missing.push("monto");
  }
  if (missing.length > 0) return notConfirmable(missing);

  const debt = await getDebtById(input.client, input.userId, debtId as string);
  if (!debt || !isActiveDebt(debt)) return notConfirmable(["deuda"]);

  const accountId = readUuid(action.account_id);
  if (accountId) {
    const account = await getAccountById(input.client, input.userId, accountId);
    if (!account) return notConfirmable(["cuenta"]);
  }

  return confirmable({ command: "record_debt_payment" });
}

function confirmable(command: Record<string, unknown>): ConfirmabilityResult {
  return {
    confirmable: true,
    confirmCommand: { ...command, checked_at: new Date().toISOString() },
    missingFields: [],
  };
}

function notConfirmable(missingFields: string[]): ConfirmabilityResult {
  return { confirmable: false, confirmCommand: null, missingFields };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readUuid(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}
