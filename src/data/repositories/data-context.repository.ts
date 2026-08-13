import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { CategoryId } from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type DataContextRecentMovement = {
  id: string;
  type: string;
  amount: number;
  currency: "PEN" | "USD";
  description: string | null;
  merchant: string | null;
  category_id: CategoryId | null;
  subcategory_id: string | null;
  related_person_id: string | null;
  occurred_at: string;
  account_origin_id: string | null;
  account_destination_id: string | null;
  status: string;
  source: string;
};

export type DataContextRecentCorrection = {
  action: string;
  field_name: string | null;
  movement_id: string | null;
  summary: string;
  created_at: string;
};

export type DataContextActiveDebt = {
  id: string;
  name: string;
  direction: "i_owe" | "they_owe_me";
  status: "active" | "due_soon" | "overdue";
  current_balance: number;
  currency: "PEN" | "USD";
  due_date: string | null;
  next_payment_date: string | null;
  related_person_id: string | null;
  related_person_name: string | null;
  related_person_aliases: string[];
  installments: Array<{
    id: string;
    number: number;
    due_date: string;
    expected_amount: number;
    paid_amount: number;
    status: "pending" | "due_soon" | "overdue";
  }>;
};

export async function listActiveDebtsForDataContext(
  client: Client,
  userId: string,
  options: { limit?: number } = {}
): Promise<DataContextActiveDebt[]> {
  try {
    const limit = Math.min(Math.max(options.limit ?? 12, 1), 20);
    const { data, error } = await client
      .from("debts")
      .select(
        `
          id,name,direction,status,current_balance,currency,due_date,
          next_payment_date,related_person_id,
          related_persons (display_name,metadata),
          debt_installments (
            id,number,due_date,expected_amount,paid_amount,status
          )
        `
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("status", ["active", "due_soon", "overdue"])
      .order("next_payment_date", { ascending: true, nullsFirst: false })
      .limit(limit);

    if (error) throw error;

    return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(
      (row) => {
        const person = asRecord(row.related_persons);
        const installments = Array.isArray(row.debt_installments)
          ? row.debt_installments
              .map(asRecord)
              .filter(
                (item) =>
                  item &&
                  ["pending", "due_soon", "overdue"].includes(
                    String(item.status)
                  )
              )
              .map((item) => ({
                id: String(item!.id),
                number: Number(item!.number),
                due_date: String(item!.due_date),
                expected_amount: Number(item!.expected_amount),
                paid_amount: Number(item!.paid_amount),
                status: String(item!.status) as
                  | "pending"
                  | "due_soon"
                  | "overdue",
              }))
              .sort((left, right) => left.number - right.number)
          : [];

        return {
          id: String(row.id),
          name: String(row.name),
          direction: String(row.direction) as "i_owe" | "they_owe_me",
          status: String(row.status) as "active" | "due_soon" | "overdue",
          current_balance: Number(row.current_balance),
          currency: row.currency === "USD" ? "USD" : "PEN",
          due_date: typeof row.due_date === "string" ? row.due_date : null,
          next_payment_date:
            typeof row.next_payment_date === "string"
              ? row.next_payment_date
              : null,
          related_person_id:
            typeof row.related_person_id === "string"
              ? row.related_person_id
              : null,
          related_person_name:
            person && typeof person.display_name === "string"
              ? person.display_name
              : null,
          related_person_aliases: readAliases(person?.metadata),
          installments,
        };
      }
    );
  } catch (error) {
    logger.warn("data_context.active_debts_failed", { error, user_id: userId });
    return [];
  }
}

export async function listRecentMovementsForDataContext(
  client: Client,
  userId: string,
  options: { limit?: number } = {},
): Promise<DataContextRecentMovement[]> {
  try {
    const limit = Math.min(Math.max(options.limit ?? 12, 1), 25);
    const { data, error } = await client
      .from("movements")
      .select(
        [
          "id",
          "type",
          "amount",
          "currency",
          "description",
          "merchant",
          "category_id",
          "subcategory_id",
          "related_person_id",
          "occurred_at",
          "account_origin_id",
          "account_destination_id",
          "status",
          "source",
        ].join(","),
      )
      .eq("user_id", userId)
      .is("deleted_at", null)
      .in("status", ["confirmed", "corrected", "needs_review"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      amount: Number(row.amount),
      currency: row.currency === "USD" ? "USD" : "PEN",
      description: typeof row.description === "string" ? row.description : null,
      merchant: typeof row.merchant === "string" ? row.merchant : null,
      category_id: (row.category_id as CategoryId | null) ?? null,
      subcategory_id:
        typeof row.subcategory_id === "string" ? row.subcategory_id : null,
      related_person_id:
        typeof row.related_person_id === "string" ? row.related_person_id : null,
      occurred_at: String(row.occurred_at),
      account_origin_id:
        typeof row.account_origin_id === "string" ? row.account_origin_id : null,
      account_destination_id:
        typeof row.account_destination_id === "string"
          ? row.account_destination_id
          : null,
      status: String(row.status),
      source: String(row.source),
    }));
  } catch (error) {
    logger.warn("data_context.recent_movements_failed", {
      error,
      user_id: userId,
    });
    return [];
  }
}

/**
 * Movimientos eliminados recientes (`status = 'deleted'`), para
 * `restaurar_movimiento` (`26` §14.2). No viven en
 * `listRecentMovementsForDataContext` porque esa lista es la de "lo que el
 * usuario tiene hoy" y se pide en todos los turnos; esta se carga solo cuando
 * el turno pide restaurar algo, mismo patron que `closedDebts` en
 * `debt-action-request.ts`.
 */
export async function listRecentlyDeletedMovementsForDataContext(
  client: Client,
  userId: string,
  options: { limit?: number } = {},
): Promise<DataContextRecentMovement[]> {
  try {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
    const { data, error } = await client
      .from("movements")
      .select(
        [
          "id",
          "type",
          "amount",
          "currency",
          "description",
          "merchant",
          "category_id",
          "subcategory_id",
          "related_person_id",
          "occurred_at",
          "account_origin_id",
          "account_destination_id",
          "status",
          "source",
        ].join(","),
      )
      .eq("user_id", userId)
      .eq("status", "deleted")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return rows.map((row) => ({
      id: String(row.id),
      type: String(row.type),
      amount: Number(row.amount),
      currency: row.currency === "USD" ? "USD" : "PEN",
      description: typeof row.description === "string" ? row.description : null,
      merchant: typeof row.merchant === "string" ? row.merchant : null,
      category_id: (row.category_id as CategoryId | null) ?? null,
      subcategory_id:
        typeof row.subcategory_id === "string" ? row.subcategory_id : null,
      related_person_id:
        typeof row.related_person_id === "string" ? row.related_person_id : null,
      occurred_at: String(row.occurred_at),
      account_origin_id:
        typeof row.account_origin_id === "string" ? row.account_origin_id : null,
      account_destination_id:
        typeof row.account_destination_id === "string"
          ? row.account_destination_id
          : null,
      status: String(row.status),
      source: String(row.source),
    }));
  } catch (error) {
    logger.warn("data_context.recently_deleted_movements_failed", {
      error,
      user_id: userId,
    });
    return [];
  }
}

export async function listRecentCorrectionsForDataContext(
  client: Client,
  userId: string,
  options: { limit?: number } = {},
): Promise<DataContextRecentCorrection[]> {
  try {
    const limit = Math.min(Math.max(options.limit ?? 10, 1), 20);
    const { data, error } = await client
      .from("movement_audit_log")
      .select("action,field_name,movement_id,created_at,old_value,new_value")
      .eq("user_id", userId)
      .eq("action", "corrected")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;
    return (data ?? []).map((row) => ({
      action: row.action,
      field_name: row.field_name ?? null,
      movement_id: row.movement_id ?? null,
      created_at: row.created_at,
      summary: summarizeCorrection(row.field_name, row.old_value, row.new_value),
    }));
  } catch (error) {
    logger.warn("data_context.recent_corrections_failed", {
      error,
      user_id: userId,
    });
    return [];
  }
}

function summarizeCorrection(
  fieldName: string | null,
  oldValue: unknown,
  newValue: unknown,
): string {
  const field = fieldName?.replace(/_/g, " ") ?? "un movimiento";
  const from = readScalar(oldValue);
  const to = readScalar(newValue);
  if (from && to) return `Corrigio ${field} de ${from} a ${to}`;
  return `Corrigio ${field}`;
}

function readScalar(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readAliases(value: unknown): string[] {
  const metadata = asRecord(value);
  if (!metadata) return [];
  for (const key of ["aliases", "alias", "nicknames", "apodos"]) {
    const item = metadata[key];
    if (Array.isArray(item)) {
      return item.filter(
        (candidate): candidate is string =>
          typeof candidate === "string" && candidate.trim().length > 0
      );
    }
    if (typeof item === "string" && item.trim()) return [item.trim()];
  }
  return [];
}
