import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import type { Database, Json } from "@/data/supabase/types";
import { appendOutboxEvent } from "@/data/repositories/events.repository";
import type {
  PendingItem,
  PendingSource,
  PendingStatus,
  PendingType,
  RiskLevel,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;
type PendingSummary = PendingItem["normalized_summary"];

const ACTIVE_PENDING_STATUSES: PendingStatus[] = [
  "pending",
  "sent_for_confirmation",
  "user_edited",
];

const TERMINAL_PENDING_STATUSES = new Set<PendingStatus>([
  "user_confirmed",
  "discarded",
  "auto_resolved_duplicate",
  "already_registered",
  "expired",
  "archived",
]);

export class PendingRepositoryError extends Error {
  constructor(
    readonly code:
      | "PENDING_REPOSITORY_ERROR"
      | "PENDING_ITEM_NOT_FOUND"
      | "PENDING_ITEM_ALREADY_RESOLVED",
    message: string
  ) {
    super(message);
    this.name = "PendingRepositoryError";
  }
}

export type CreatePendingItemResult = {
  pendingItem: PendingItem;
  idempotent: boolean;
};

export async function createPendingItem(
  client: Client,
  input: {
    userId: string;
    type: PendingType;
    source: PendingSource;
    sourceRef: string | null;
    proposedAction: Record<string, unknown>;
    normalizedSummary: PendingSummary;
    riskLevel: RiskLevel;
    status?: PendingStatus;
    expiresAt?: string | null;
    metadata?: Record<string, unknown>;
    traceId?: string;
  }
): Promise<CreatePendingItemResult> {
  const { data, error } = await client
    .from("pending_items")
    .insert({
      user_id: input.userId,
      type: input.type,
      status: input.status ?? "pending",
      source: input.source,
      source_ref: input.sourceRef,
      proposed_action: input.proposedAction as Json,
      normalized_summary: input.normalizedSummary as Json,
      risk_level: input.riskLevel,
      expires_at: input.expiresAt ?? null,
      metadata: (input.metadata ?? {}) as Json,
    })
    .select("*")
    .single();

  if (error || !data) {
    if (isUniqueViolation(error) && input.sourceRef) {
      const existing = await getPendingItemBySourceRef(client, {
        userId: input.userId,
        source: input.source,
        sourceRef: input.sourceRef,
      });

      if (existing) {
        return { pendingItem: existing, idempotent: true };
      }
    }

    logger.error("pending_items.create_failed", {
      error,
      user_id: input.userId,
      source: input.source,
      source_ref: input.sourceRef,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo crear el pendiente"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_created",
      traceId: input.traceId,
      payload: {
        created_from: input.source,
      },
    })
  );

  return { pendingItem, idempotent: false };
}

export async function listPendingItems(
  client: Client,
  userId: string,
  options: {
    statuses?: PendingStatus[];
    source?: PendingSource;
    type?: PendingType;
    limit?: number;
    /** Filtro `.or(...)` de cursor ya construido (`pagination.ts`,
     * `buildCursorOrFilter("created_at", cursor, "desc")`). */
    cursorFilter?: string;
  } = {}
): Promise<PendingItem[]> {
  const statuses = options.statuses ?? ACTIVE_PENDING_STATUSES;
  const limit = options.limit ?? 50;

  let builder = client
    .from("pending_items")
    .select("*")
    .eq("user_id", userId)
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (options.source) builder = builder.eq("source", options.source);
  if (options.type) builder = builder.eq("type", options.type);
  if (options.cursorFilter) builder = builder.or(options.cursorFilter);

  const { data, error } = await builder;

  if (error) {
    logger.error("pending_items.list_failed", { error, user_id: userId });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudieron leer los pendientes"
    );
  }

  return (data ?? []) as PendingItem[];
}

export async function getPendingItemById(
  client: Client,
  userId: string,
  pendingItemId: string
): Promise<PendingItem | null> {
  const { data, error } = await client
    .from("pending_items")
    .select("*")
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .maybeSingle();

  if (error) {
    logger.error("pending_items.get_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo leer el pendiente"
    );
  }

  return (data as PendingItem | null) ?? null;
}

export async function markPendingSentForConfirmation(
  client: Client,
  input: {
    userId: string;
    pendingItemId: string;
    traceId: string;
    deliveryMode: "freeform" | "interactive" | "template";
    providerMessageId: string | null;
    idempotencyKey: string;
    sentAt?: string;
  },
): Promise<PendingItem> {
  const existing = await requireEditablePending(
    client,
    input.userId,
    input.pendingItemId,
  );
  const sentAt = input.sentAt ?? new Date().toISOString();
  const { data, error } = await client
    .from("pending_items")
    .update({
      status: "sent_for_confirmation",
      sent_for_confirmation_at:
        existing.sent_for_confirmation_at ?? sentAt,
      metadata: {
        ...existing.metadata,
        whatsapp_confirmation_sent_at: sentAt,
        whatsapp_delivery_mode: input.deliveryMode,
        whatsapp_provider_message_id: input.providerMessageId,
        whatsapp_idempotency_key: input.idempotencyKey,
      } as Json,
    })
    .eq("user_id", input.userId)
    .eq("id", input.pendingItemId)
    .select("*")
    .single();
  if (error || !data) {
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo marcar el pendiente enviado para confirmacion",
    );
  }
  const pendingItem = data as PendingItem;
  if (existing.status !== "sent_for_confirmation") {
    await appendOutboxEvent(
      client,
      buildPendingOutboxEvent({
        pendingItem,
        eventType: "pending_sent_for_confirmation",
        traceId: input.traceId,
        payload: {
          delivery_mode: input.deliveryMode,
          provider_message_id: input.providerMessageId,
        },
      }),
    );
  }
  return pendingItem;
}

export async function recordPendingWhatsAppPolicyDecision(
  client: Client,
  input: {
    userId: string;
    pendingItemId: string;
    reason: string;
    traceId: string;
    scheduledFor?: string | null;
  },
): Promise<void> {
  const existing = await getPendingItemById(
    client,
    input.userId,
    input.pendingItemId,
  );
  if (!existing || isTerminalPendingStatus(existing.status)) return;
  const { error } = await client
    .from("pending_items")
    .update({
      metadata: {
        ...existing.metadata,
        whatsapp_policy_reason: input.reason,
        whatsapp_policy_trace_id: input.traceId,
        whatsapp_policy_evaluated_at: new Date().toISOString(),
        whatsapp_delivery_scheduled_for: input.scheduledFor ?? null,
      } as Json,
    })
    .eq("user_id", input.userId)
    .eq("id", input.pendingItemId);
  if (error) {
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo guardar la politica WhatsApp del pendiente",
    );
  }
}

export async function schedulePendingConfirmationDelivery(
  client: Client,
  input: {
    userId: string;
    pendingItemId: string;
    traceId: string;
    scheduledFor: string;
    reason: string;
  },
): Promise<void> {
  const id = stableUuid(
    `pending-confirmation-delivery:${input.pendingItemId}`,
  );
  const { error } = await client.from("transactional_outbox").upsert(
    {
      id,
      user_id: input.userId,
      event_type: "pending_confirmation_delivery_requested",
      aggregate_type: "pending_item",
      aggregate_id: input.pendingItemId,
      payload: {
        pending_item_id: input.pendingItemId,
        source: "email_pending",
        scheduled_reason: input.reason,
      } as Json,
      payload_version: 1,
      status: "pending",
      trace_id: input.traceId,
      next_attempt_at: input.scheduledFor,
      metadata: {
        financial_write: false,
        delivery_channel: "policy_controlled",
        scheduled_reason: input.reason,
      } as Json,
    },
    { onConflict: "id", ignoreDuplicates: true },
  );
  if (error) {
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo programar la confirmacion por WhatsApp",
    );
  }
}

async function getPendingItemBySourceRef(
  client: Client,
  input: {
    userId: string;
    source: PendingSource;
    sourceRef: string;
  }
): Promise<PendingItem | null> {
  const { data, error } = await client
    .from("pending_items")
    .select("*")
    .eq("user_id", input.userId)
    .eq("source", input.source)
    .eq("source_ref", input.sourceRef)
    .maybeSingle();

  if (error) {
    logger.error("pending_items.get_by_source_ref_failed", {
      error,
      user_id: input.userId,
      source: input.source,
      source_ref: input.sourceRef,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo leer el pendiente"
    );
  }

  return (data as PendingItem | null) ?? null;
}

export async function updatePendingSummary(
  client: Client,
  userId: string,
  pendingItemId: string,
  normalizedSummary: PendingSummary,
  traceId?: string,
  proposedAction?: Record<string, unknown>,
  /** RUL-PEND-01: recalculada por quien llama (computeConfirmability) —
   * este repositorio no decide confirmabilidad, solo la persiste. */
  confirmability?: {
    confirmable: boolean;
    confirmCommand: Record<string, unknown> | null;
    missingFields: string[];
  },
): Promise<PendingItem> {
  const existing = await requireEditablePending(client, userId, pendingItemId);
  const metadata = withoutDuplicateConfirmationMetadata(existing.metadata);

  const { data, error } = await client
    .from("pending_items")
    .update({
      normalized_summary: normalizedSummary as Json,
      ...(proposedAction
        ? { proposed_action: proposedAction as Json }
        : {}),
      status: "user_edited",
      ...(confirmability
        ? {
            confirmable: confirmability.confirmable,
            confirm_command: confirmability.confirmCommand as Json | null,
          }
        : {}),
      metadata: {
        ...metadata,
        last_user_edit_at: new Date().toISOString(),
        ...(confirmability
          ? { missing_fields: confirmability.missingFields }
          : {}),
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("pending_items.update_summary_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo actualizar el pendiente"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_edited",
      traceId,
      payload: {
        edited_fields: Object.keys(normalizedSummary),
        proposed_action_edited: Boolean(proposedAction),
      },
    })
  );

  return pendingItem;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  return (error as { code?: unknown }).code === "23505";
}

export async function markPendingDiscarded(
  client: Client,
  userId: string,
  pendingItemId: string,
  reason: string,
  actorId: string,
  traceId?: string
): Promise<PendingItem> {
  const existing = await requireEditablePending(client, userId, pendingItemId);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("pending_items")
    .update({
      status: "discarded",
      resolved_at: now,
      resolved_by: actorId,
      metadata: {
        ...existing.metadata,
        discard_reason: reason,
        discarded_at: now,
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("pending_items.mark_discarded_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo descartar el pendiente"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_discarded",
      traceId,
      payload: {
        reason,
      },
    })
  );

  return pendingItem;
}

export async function markPendingDuplicateConfirmationRequested(
  client: Client,
  userId: string,
  pendingItemId: string,
  decision: {
    status: string;
    matched_reference_id: string | null;
    score: number;
    reasons: string[];
  },
  traceId?: string
): Promise<PendingItem> {
  const existing = await requireEditablePending(client, userId, pendingItemId);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("pending_items")
    .update({
      metadata: {
        ...existing.metadata,
        dedup_confirmation_requested_at: now,
        dedup_status: decision.status,
        dedup_matched_reference_id: decision.matched_reference_id,
        dedup_score: decision.score,
        dedup_reasons: decision.reasons,
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("pending_items.mark_duplicate_confirmation_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo preparar la confirmacion del posible duplicado"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_duplicate_confirmation_requested",
      traceId,
      payload: {
        dedup_status: decision.status,
        matched_movement_id: decision.matched_reference_id,
        dedup_score: decision.score,
      },
    })
  );

  return pendingItem;
}

/**
 * RUL-PEND-05: "ya lo registré" (el hecho es real, ya está en el sistema)
 * es distinto de "no era eso" (`markPendingDiscarded`) — alimenta la
 * deduplicación, no evidencia negativa de la deteccion.
 */
export async function markPendingAlreadyRegistered(
  client: Client,
  userId: string,
  pendingItemId: string,
  actorId: string,
  matchedMovementId: string | null,
  traceId?: string
): Promise<PendingItem> {
  const existing = await requireEditablePending(client, userId, pendingItemId);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("pending_items")
    .update({
      status: "already_registered",
      resolved_at: now,
      resolved_by: actorId,
      metadata: {
        ...existing.metadata,
        already_registered_at: now,
        linked_movement_id: matchedMovementId,
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("pending_items.mark_already_registered_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo marcar el pendiente como ya registrado"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_already_registered",
      traceId,
      payload: {
        linked_movement_id: matchedMovementId,
      },
    })
  );

  return pendingItem;
}

/** RUL-EMAIL-11/ACT-PEND-09: contexto libre, aportado antes o al confirmar. */
export async function addPendingContext(
  client: Client,
  userId: string,
  pendingItemId: string,
  context: string,
  traceId?: string
): Promise<PendingItem> {
  const existing = await requireEditablePending(client, userId, pendingItemId);

  const { data, error } = await client
    .from("pending_items")
    .update({
      metadata: {
        ...existing.metadata,
        user_context: context,
        user_context_at: new Date().toISOString(),
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("pending_items.add_context_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo guardar el contexto"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_context_added",
      traceId,
      payload: {},
    })
  );

  return pendingItem;
}

/**
 * RUL-PEND-07/ACT-PEND-07: etiqueta un pendiente ya confirmado con el
 * lote al que perteneció, para que el deshacer de 24h sepa qué revertir.
 * No cambia estado ni dispara eventos — es solo metadata de trazabilidad.
 */
export async function markPendingBatchConfirmId(
  client: Client,
  userId: string,
  pendingItemId: string,
  batchId: string
): Promise<void> {
  const existing = await getPendingItemById(client, userId, pendingItemId);
  if (!existing) return;
  const { error } = await client
    .from("pending_items")
    .update({
      metadata: {
        ...existing.metadata,
        batch_confirm_id: batchId,
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId);
  if (error) {
    logger.error("pending_items.mark_batch_confirm_id_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
      batch_id: batchId,
    });
  }
}

/**
 * Lista los pendientes de un lote confirmado, para el deshacer
 * (`POST /pending/batch/[batch_id]/undo`).
 */
/**
 * `41` fase 2: correlaciona los pendientes que un turno del asistente web
 * acaba de crear, usando el mismo `source_ref` determinista que
 * `buildPendingSourceRef` ya escribe (`"{channel}:{externalEventId}:{actionId}"`,
 * `data-action-pending.ts`) — sin inventar una segunda forma de enlazar un
 * bloque `propuesta` con su pendiente real.
 */
export async function listPendingItemsBySourceRefPrefix(
  client: Client,
  userId: string,
  sourceRefPrefix: string
): Promise<PendingItem[]> {
  const { data, error } = await client
    .from("pending_items")
    .select("*")
    .eq("user_id", userId)
    .like("source_ref", `${sourceRefPrefix}%`)
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("pending_items.list_by_source_ref_prefix_failed", {
      error,
      user_id: userId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudieron leer los pendientes del turno"
    );
  }

  return (data ?? []) as PendingItem[];
}

export async function listPendingItemsByBatchId(
  client: Client,
  userId: string,
  batchId: string
): Promise<PendingItem[]> {
  const { data, error } = await client
    .from("pending_items")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "user_confirmed")
    .eq("metadata->>batch_confirm_id", batchId);

  if (error) {
    logger.error("pending_items.list_by_batch_failed", {
      error,
      user_id: userId,
      batch_id: batchId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo leer el lote"
    );
  }

  return (data ?? []) as PendingItem[];
}

/**
 * Deshace el lado del pendiente al deshacer un lote: vuelve a `pending`
 * (no es un estado terminal nuevo, es reabrir lo que el lote cerro), sin
 * pasar por `requireEditablePending` porque el estado actual SI es
 * terminal (`user_confirmed`) a proposito.
 */
export async function reopenPendingAfterBatchUndo(
  client: Client,
  userId: string,
  pendingItemId: string,
  traceId?: string
): Promise<PendingItem> {
  const existing = await getPendingItemById(client, userId, pendingItemId);
  if (!existing) {
    throw new PendingRepositoryError(
      "PENDING_ITEM_NOT_FOUND",
      "Pendiente no encontrado"
    );
  }
  const { data, error } = await client
    .from("pending_items")
    .update({
      status: "pending",
      resolved_at: null,
      resolved_by: null,
      metadata: {
        ...existing.metadata,
        batch_undone_at: new Date().toISOString(),
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("pending_items.reopen_after_batch_undo_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo reabrir el pendiente"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_batch_undone",
      traceId,
      payload: {},
    })
  );

  return pendingItem;
}

export async function markPendingAutoResolvedDuplicate(
  client: Client,
  userId: string,
  pendingItemId: string,
  matchedMovementId: string,
  actorId: string,
  traceId?: string
): Promise<PendingItem> {
  const existing = await requireEditablePending(client, userId, pendingItemId);
  const now = new Date().toISOString();

  const { data, error } = await client
    .from("pending_items")
    .update({
      status: "auto_resolved_duplicate",
      resolved_at: now,
      resolved_by: actorId,
      metadata: {
        ...existing.metadata,
        duplicate_movement_id: matchedMovementId,
        auto_resolved_duplicate_at: now,
      } as Json,
    })
    .eq("user_id", userId)
    .eq("id", pendingItemId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("pending_items.mark_auto_resolved_duplicate_failed", {
      error,
      user_id: userId,
      pending_item_id: pendingItemId,
      matched_movement_id: matchedMovementId,
    });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo resolver el pendiente duplicado"
    );
  }

  const pendingItem = data as PendingItem;
  await appendOutboxEvent(
    client,
    buildPendingOutboxEvent({
      pendingItem,
      eventType: "pending_auto_resolved_duplicate",
      traceId,
      payload: {
        matched_movement_id: matchedMovementId,
      },
    })
  );

  return pendingItem;
}

const ACTIVE_NON_TERMINAL_STATUSES: PendingStatus[] = [
  "pending",
  "sent_for_confirmation",
  "user_edited",
];

/**
 * RUL-PEND-08: un pendiente sin resolver caduca a los 60 dias. No borra
 * nada — su evidencia sigue sirviendo para deduplicacion (27 S6).
 * Ejecutado por un trabajo programado, no en cada lectura (27 S17).
 */
export async function expireOverduePendingItems(
  client: Client,
  asOf?: string
): Promise<{ expired_count: number; pending_item_ids: string[] }> {
  const cutoff = asOf ?? new Date().toISOString();
  const { data, error } = await client
    .from("pending_items")
    .update({ status: "expired", resolved_at: cutoff })
    .in("status", ACTIVE_NON_TERMINAL_STATUSES)
    .lt("expires_at", cutoff)
    .select("id");

  if (error) {
    logger.error("pending_items.expire_overdue_failed", { error });
    throw new PendingRepositoryError(
      "PENDING_REPOSITORY_ERROR",
      "No se pudo caducar los pendientes vencidos"
    );
  }

  const ids = (data ?? []).map((row) => (row as { id: string }).id);
  return { expired_count: ids.length, pending_item_ids: ids };
}

export function hasPendingDuplicateConfirmation(
  pendingItem: PendingItem
): boolean {
  return typeof pendingItem.metadata.dedup_confirmation_requested_at === "string";
}

export function isTerminalPendingStatus(status: PendingStatus): boolean {
  return TERMINAL_PENDING_STATUSES.has(status);
}

async function requireEditablePending(
  client: Client,
  userId: string,
  pendingItemId: string
): Promise<PendingItem> {
  const pendingItem = await getPendingItemById(client, userId, pendingItemId);

  if (!pendingItem) {
    throw new PendingRepositoryError(
      "PENDING_ITEM_NOT_FOUND",
      "Pendiente no encontrado"
    );
  }

  if (isTerminalPendingStatus(pendingItem.status)) {
    throw new PendingRepositoryError(
      "PENDING_ITEM_ALREADY_RESOLVED",
      "Este pendiente ya fue resuelto"
    );
  }

  return pendingItem;
}

function buildPendingOutboxEvent(params: {
  pendingItem: PendingItem;
  eventType: string;
  traceId?: string;
  payload?: Record<string, unknown>;
}): OutboxEventDraft {
  const { pendingItem } = params;

  return {
    id: randomUUID(),
    user_id: pendingItem.user_id,
    event_type: params.eventType,
    aggregate_type: "pending_item",
    aggregate_id: pendingItem.id,
    payload_version: 1,
    trace_id: params.traceId ?? randomUUID(),
    payload: {
      pending_item_id: pendingItem.id,
      pending_type: pendingItem.type,
      pending_status: pendingItem.status,
      pending_source: pendingItem.source,
      source_ref: pendingItem.source_ref,
      ...params.payload,
    },
    metadata: {
      risk_level: pendingItem.risk_level,
    },
  };
}

function withoutDuplicateConfirmationMetadata(
  metadata: Record<string, unknown>
): Record<string, unknown> {
  const next = { ...metadata };
  delete next.dedup_confirmation_requested_at;
  delete next.dedup_status;
  delete next.dedup_matched_reference_id;
  delete next.dedup_score;
  delete next.dedup_reasons;
  return next;
}

function stableUuid(value: string): string {
  const hex = createHash("sha256")
    .update(value, "utf8")
    .digest("hex")
    .slice(0, 32)
    .split("");
  hex[12] = "5";
  hex[16] = ["8", "9", "a", "b"][
    Number.parseInt(hex[16] ?? "0", 16) % 4
  ];
  const compact = hex.join("");
  return `${compact.slice(0, 8)}-${compact.slice(8, 12)}-${compact.slice(12, 16)}-${compact.slice(16, 20)}-${compact.slice(20)}`;
}
