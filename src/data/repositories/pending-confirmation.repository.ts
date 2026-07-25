import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinancialCoreRepository, MovementCommitPayload } from "@/core/finance/repository";
import { CoreError } from "@/core/finance/errors";
import type { Database, Json } from "@/data/supabase/types";
import { PendingRepositoryError } from "@/data/repositories/pending.repository";
import type { Movement, PendingItem } from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type PendingConfirmationResult = {
  pendingItem: PendingItem;
  movement: Movement;
  idempotent: boolean;
};

export class SupabasePendingConfirmationRepository
  implements FinancialCoreRepository
{
  lastResult: PendingConfirmationResult | null = null;

  constructor(
    private readonly client: Client,
    private readonly params: {
      pendingItem: PendingItem;
      actorId: string;
      traceId: string;
    }
  ) {}

  async findMovementByIdempotencyKey(): Promise<Movement | null> {
    // Confirming a pending item must go through the atomic RPC even when the
    // movement exists already, so a retry can repair a half-finished old flow.
    return null;
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
      logger.error("pending_confirmation.get_movement_failed", {
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
      "confirm_pending_with_movement",
      {
        p_user_id: this.params.pendingItem.user_id,
        p_pending_id: this.params.pendingItem.id,
        p_actor_id: this.params.actorId,
        p_movement: toJson(payload.movement),
        p_audit_logs: toJson(payload.auditLogs),
        p_account_deltas: toJson(payload.accountDeltas),
        p_box_deltas: toJson(payload.boxDeltas),
        p_movement_outbox_events: toJson(payload.outboxEvents),
        p_trace_id: this.params.traceId,
      }
    );

    if (error || !data) {
      handleRpcError(error, this.params.pendingItem);
    }

    const result = parsePendingConfirmationResult(data);
    this.lastResult = result;
    return result.movement;
  }

  async commitUpdateMovement(): Promise<Movement> {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "Este repositorio solo confirma pendientes creando movimientos"
    );
  }
}

function handleRpcError(
  error: unknown,
  pendingItem: PendingItem
): never {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : "No se pudo confirmar el pendiente";

  logger.error("pending_confirmation.commit_failed", {
    error,
    user_id: pendingItem.user_id,
    pending_item_id: pendingItem.id,
  });

  if (message.includes("PENDING_ITEM_NOT_FOUND")) {
    throw new PendingRepositoryError(
      "PENDING_ITEM_NOT_FOUND",
      "Pendiente no encontrado"
    );
  }

  if (message.includes("PENDING_ITEM_ALREADY_RESOLVED")) {
    throw new PendingRepositoryError(
      "PENDING_ITEM_ALREADY_RESOLVED",
      "Este pendiente ya fue resuelto"
    );
  }

  throw new CoreError(
    "CORE_REPOSITORY_ERROR",
    "No se pudo confirmar el pendiente"
  );
}

function parsePendingConfirmationResult(data: Json): PendingConfirmationResult {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "Respuesta invalida al confirmar el pendiente"
    );
  }

  const record = data as Record<string, unknown>;
  const pendingItem = record.pending_item;
  const movement = record.movement;

  if (
    !pendingItem ||
    typeof pendingItem !== "object" ||
    Array.isArray(pendingItem) ||
    !movement ||
    typeof movement !== "object" ||
    Array.isArray(movement)
  ) {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "Respuesta incompleta al confirmar el pendiente"
    );
  }

  return {
    pendingItem: pendingItem as PendingItem,
    movement: movement as Movement,
    idempotent: record.idempotent === true,
  };
}

function toJson(value: unknown): Json {
  return value as Json;
}
