import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import type { Box } from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

/**
 * Lado de datos de la escritura conversacional de estructura
 * (`RUL-ESTR-01`, `RUL-ESTR-04`).
 *
 * Metas y presupuestos ya tienen ejecutor transaccional propio en Postgres
 * (`commit_goal_operation`, `commit_budget_operation`), con su propio almacen
 * de idempotencia y sus eventos de outbox; este modulo no los duplica, los usa
 * (ver `budgets.repository.ts`).
 *
 * Las cajas no tienen RPC: se escriben sobre `public.boxes`, que ya trae la
 * unicidad `boxes_unique_name_per_account` como red dura contra duplicados.
 * Aqui se le suma la idempotencia por clave y el rastro de auditoria, que la
 * tabla por si sola no da.
 */

export class StructureRepositoryError extends Error {
  constructor(
    readonly code:
      | "BOX_NAME_TAKEN"
      | "BOX_NOT_FOUND"
      | "STRUCTURE_WRITE_FAILED",
    message: string
  ) {
    super(message);
    this.name = "StructureRepositoryError";
  }
}

/** Clave de idempotencia con la que se sella una caja creada por conversacion. */
export const BOX_STRUCTURE_IDEMPOTENCY_METADATA_KEY =
  "structure_idempotency_key";

/**
 * Busca una caja ya creada por esta misma clave. Es el primer tramo de la
 * idempotencia: un doble envio del mismo boton encuentra la caja de la primera
 * vez en vez de intentar crear otra.
 */
export async function findBoxByStructureIdempotencyKey(
  client: Client,
  userId: string,
  idempotencyKey: string
): Promise<Box | null> {
  const { data, error } = await client
    .from("boxes")
    .select("*")
    .eq("user_id", userId)
    .contains("metadata", {
      [BOX_STRUCTURE_IDEMPOTENCY_METADATA_KEY]: idempotencyKey,
    })
    .limit(1);

  if (error) {
    logger.error("structure.find_box_by_idempotency_failed", {
      error,
      user_id: userId,
    });
    throw new StructureRepositoryError(
      "STRUCTURE_WRITE_FAILED",
      "No pude comprobar si esa caja ya existia."
    );
  }

  const rows = (data ?? []) as Box[];
  return rows[0] ?? null;
}

/**
 * Rastro de auditoria de una escritura de estructura.
 *
 * Reusa `movement_audit_log`, que ya es generico (`entity_type` libre,
 * `movement_id` anulable) y es donde `appendClassificationAudit` deja las
 * escrituras de clasificacion. Una caja, una meta o un presupuesto creados
 * conversando quedan con el mismo actor, origen y traza que un movimiento.
 */
export async function appendStructureAudit(
  client: Client,
  input: {
    userId: string;
    entityType: "box" | "goal" | "budget";
    entityId: string;
    action: "created" | "updated";
    actorType: "user" | "agent" | "system" | "worker";
    actorId: string | null;
    source: string;
    traceId: string;
    commandId: string;
    idempotencyKey: string;
    oldValue: unknown;
    newValue: unknown;
  }
): Promise<void> {
  const { error } = await client.from("movement_audit_log").insert({
    user_id: input.userId,
    movement_id: null,
    entity_type: input.entityType,
    entity_id: input.entityId,
    action: input.action,
    field_name: null,
    old_value: (input.oldValue ?? null) as Json,
    new_value: (input.newValue ?? null) as Json,
    source: input.source,
    actor_type: input.actorType,
    actor_id: input.actorId,
    trace_id: input.traceId,
    metadata: {
      command_id: input.commandId,
      idempotency_key: input.idempotencyKey,
      surface: "conversational_structure",
    },
  });

  if (error) {
    logger.error("structure.audit_append_failed", {
      error,
      user_id: input.userId,
      entity_type: input.entityType,
    });
    throw new StructureRepositoryError(
      "STRUCTURE_WRITE_FAILED",
      "No pude dejar rastro de ese cambio."
    );
  }
}

/** `23505`/`23P01`: el nombre de caja ya esta tomado en esa cuenta. */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "23505" || code === "23P01";
}
