import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import type { Movement } from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";
import type {
  FinancialCoreRepository,
  MovementCommitPayload,
} from "@/core/finance/repository";
import type { DedupComparableMovement } from "@/core/dedup";
import { CoreError } from "@/core/finance/errors";

type Client = SupabaseClient<Database>;

export type RecentMovementForCorrection = Pick<
  Movement,
  | "id"
  | "type"
  | "amount"
  | "currency"
  | "description"
  | "merchant"
  | "category_id"
  | "occurred_at"
  | "created_at"
  | "status"
  | "account_origin_id"
  | "account_destination_id"
  | "metadata"
>;

type RecentMovementForPreflight = Pick<
  Movement,
  | "id"
  | "type"
  | "amount"
  | "currency"
  | "occurred_at"
  | "description"
  | "merchant"
  | "source"
  | "source_ref"
  | "account_origin_id"
  | "account_destination_id"
>;

export async function listRecentMovementsForCorrection(
  client: Client,
  userId: string,
  options: { limit?: number } = {}
): Promise<RecentMovementForCorrection[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 5, 10));
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
        "occurred_at",
        "created_at",
        "status",
        "account_origin_id",
        "account_destination_id",
        "metadata",
      ].join(",")
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["confirmed", "corrected", "needs_review"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("movements.list_recent_for_correction_failed", {
      error,
      user_id: userId,
    });
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "No se pudieron leer movimientos recientes"
    );
  }

  return (data ?? []) as unknown as RecentMovementForCorrection[];
}

export async function listRecentMovementsForPreflight(
  client: Client,
  userId: string,
  options: { limit?: number } = {},
): Promise<DedupComparableMovement[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 100, 200));
  const { data, error } = await client
    .from("movements")
    .select(
      [
        "id",
        "type",
        "amount",
        "currency",
        "occurred_at",
        "description",
        "merchant",
        "source",
        "source_ref",
        "account_origin_id",
        "account_destination_id",
      ].join(","),
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .in("status", ["confirmed", "corrected", "needs_review"])
    .order("occurred_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("movements.list_recent_for_preflight_failed", {
      error,
      user_id: userId,
    });
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "No se pudo ejecutar el control previo de movimientos",
    );
  }

  const rows = (data ?? []) as unknown as RecentMovementForPreflight[];
  return rows.flatMap((row) => {
    if (row.amount === null) return [];
    return [{
      reference_id: row.id,
      movement_type: row.type,
      amount: Number(row.amount),
      currency: row.currency,
      occurred_at: row.occurred_at,
      description: row.description,
      merchant: row.merchant,
      source: row.source,
      source_ref: row.source_ref,
      account_origin_id: row.account_origin_id,
      account_destination_id: row.account_destination_id,
    } satisfies DedupComparableMovement];
  });
}

export class SupabaseFinancialCoreRepository
  implements FinancialCoreRepository
{
  constructor(private readonly client: Client) {}

  async findMovementByIdempotencyKey(
    userId: string,
    idempotencyKey: string
  ): Promise<Movement | null> {
    const { data, error } = await this.client
      .from("movements")
      .select("*")
      .eq("user_id", userId)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();

    if (error) {
      logger.error("movements.find_by_idempotency_failed", {
        error,
        user_id: userId,
      });
      throw new CoreError(
        "CORE_REPOSITORY_ERROR",
        "No se pudo verificar idempotencia"
      );
    }

    return (data as Movement | null) ?? null;
  }

  async getMovementById(
    userId: string,
    movementId: string
  ): Promise<Movement | null> {
    const { data, error } = await this.client
      .from("movements")
      .select("*")
      .eq("user_id", userId)
      .eq("id", movementId)
      .maybeSingle();

    if (error) {
      logger.error("movements.get_by_id_failed", {
        error,
        user_id: userId,
        movement_id: movementId,
      });
      throw new CoreError(
        "CORE_REPOSITORY_ERROR",
        "No se pudo leer el movimiento"
      );
    }

    return (data as Movement | null) ?? null;
  }

  async commitCreateMovement(
    payload: MovementCommitPayload
  ): Promise<Movement> {
    const { data, error } = await this.client.rpc(
      "core_commit_movement_create",
      {
        p_movement: toJson(payload.movement),
        p_audit_logs: toJson(payload.auditLogs),
        p_account_deltas: toJson(payload.accountDeltas),
        p_box_deltas: toJson(payload.boxDeltas),
        p_outbox_events: toJson(payload.outboxEvents),
      }
    );

    if (error || !data) {
      logger.error("movements.commit_create_failed", {
        error,
        user_id: payload.movement.user_id,
      });
      throw new CoreError(
        "CORE_REPOSITORY_ERROR",
        "No se pudo guardar el movimiento"
      );
    }

    return data as Movement;
  }

  async commitUpdateMovement(
    payload: MovementCommitPayload
  ): Promise<Movement> {
    const { data, error } = await this.client.rpc(
      "core_commit_movement_update",
      {
        p_movement: toJson(payload.movement),
        p_audit_logs: toJson(payload.auditLogs),
        p_account_deltas: toJson(payload.accountDeltas),
        p_box_deltas: toJson(payload.boxDeltas),
        p_outbox_events: toJson(payload.outboxEvents),
      }
    );

    if (error || !data) {
      logger.error("movements.commit_update_failed", {
        error,
        user_id: payload.movement.user_id,
        movement_id: payload.movement.id,
      });
      throw new CoreError(
        "CORE_REPOSITORY_ERROR",
        "No se pudo actualizar el movimiento"
      );
    }

    return data as Movement;
  }
}

function toJson(value: unknown): Json {
  return value as Json;
}
