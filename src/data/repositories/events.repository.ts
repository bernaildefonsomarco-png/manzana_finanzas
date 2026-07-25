import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import {
  toJson,
  type ExternalEventLog,
  type InternalEventConsumerStatus,
  type InternalEventLog,
  type OutboxEvent,
  type OutboxEventDraft,
} from "@/core/events/domain-events";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export class EventsRepositoryError extends Error {
  constructor(
    readonly code:
      | "EVENTS_REPOSITORY_ERROR"
      | "EXTERNAL_EVENT_DUPLICATE"
      | "OUTBOX_EVENT_DUPLICATE",
    message: string
  ) {
    super(message);
    this.name = "EventsRepositoryError";
  }
}

export async function recordExternalEvent(
  client: Client,
  input: {
    source: ExternalEventLog["source"];
    event_type: string;
    idempotency_key: string;
    user_id: string | null;
    payload_hash: string;
    payload_ref?: string | null;
    trace_id: string;
    metadata?: Record<string, unknown>;
  }
): Promise<ExternalEventLog> {
  const { data, error } = await client
    .from("external_event_log")
    .insert({
      ...input,
      payload_ref: input.payload_ref ?? null,
      metadata: toJson(input.metadata ?? {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new EventsRepositoryError(
        "EXTERNAL_EVENT_DUPLICATE",
        "Evento externo duplicado"
      );
    }

    logger.error("events.record_external_failed", {
      error,
      source: input.source,
      event_type: input.event_type,
    });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo registrar el evento externo"
    );
  }

  return data as ExternalEventLog;
}

export async function getExternalEventById(
  client: Client,
  externalEventId: string
): Promise<ExternalEventLog | null> {
  const { data, error } = await client
    .from("external_event_log")
    .select("*")
    .eq("id", externalEventId)
    .maybeSingle();

  if (error) {
    logger.error("events.get_external_by_id_failed", {
      error,
      external_event_id: externalEventId,
    });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo leer el evento externo"
    );
  }

  return (data as ExternalEventLog | null) ?? null;
}

export async function getExternalEventByIdempotencyKey(
  client: Client,
  input: {
    source: ExternalEventLog["source"];
    idempotency_key: string;
  }
): Promise<ExternalEventLog | null> {
  const { data, error } = await client
    .from("external_event_log")
    .select("*")
    .eq("source", input.source)
    .eq("idempotency_key", input.idempotency_key)
    .maybeSingle();

  if (error) {
    logger.error("events.get_external_by_idempotency_failed", {
      error,
      source: input.source,
    });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo leer el evento externo"
    );
  }

  return (data as ExternalEventLog | null) ?? null;
}

export async function updateExternalEventStatus(
  client: Client,
  input: {
    external_event_id: string;
    status: ExternalEventLog["status"];
    metadata?: Record<string, unknown>;
  }
): Promise<ExternalEventLog> {
  const existing = await getExternalEventById(client, input.external_event_id);
  if (!existing) {
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "Evento externo no encontrado"
    );
  }

  const { data, error } = await client
    .from("external_event_log")
    .update({
      status: input.status,
      metadata: toJson({
        ...existing.metadata,
        ...(input.metadata ?? {}),
      }),
    })
    .eq("id", input.external_event_id)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("events.update_external_status_failed", {
      error,
      external_event_id: input.external_event_id,
      status: input.status,
    });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo actualizar el evento externo"
    );
  }

  return data as ExternalEventLog;
}

export async function appendOutboxEvent(
  client: Client,
  event: OutboxEventDraft
): Promise<OutboxEvent> {
  const { data, error } = await client
    .from("transactional_outbox")
    .insert({
      id: event.id,
      user_id: event.user_id,
      event_type: event.event_type,
      aggregate_type: event.aggregate_type,
      aggregate_id: event.aggregate_id,
      payload: toJson(event.payload),
      payload_version: event.payload_version,
      status: event.status ?? "pending",
      trace_id: event.trace_id,
      metadata: toJson(event.metadata),
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new EventsRepositoryError(
        "OUTBOX_EVENT_DUPLICATE",
        "Evento de outbox duplicado"
      );
    }

    logger.error("events.append_outbox_failed", {
      error,
      event_type: event.event_type,
      aggregate_id: event.aggregate_id,
    });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo escribir el outbox"
    );
  }

  return data as OutboxEvent;
}

export async function claimOutboxEvents(
  client: Client,
  limit = 25
): Promise<OutboxEvent[]> {
  const { data, error } = await client.rpc("claim_outbox_events", {
    p_limit: limit,
  });

  if (error) {
    logger.error("events.claim_outbox_failed", { error, limit });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudieron reclamar eventos del outbox"
    );
  }

  return (data ?? []) as OutboxEvent[];
}

export async function markOutboxPublished(
  client: Client,
  outboxId: string
): Promise<OutboxEvent> {
  const { data, error } = await client.rpc("mark_outbox_published", {
    p_outbox_id: outboxId,
  });

  if (error || !data) {
    logger.error("events.mark_published_failed", { error, outbox_id: outboxId });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo marcar el evento como publicado"
    );
  }

  return data as OutboxEvent;
}

export async function markOutboxFailed(
  client: Client,
  outbox: OutboxEvent,
  errorMessage: string
): Promise<OutboxEvent> {
  const deadLetter = outbox.attempt_count >= outbox.max_attempts;
  const { data, error } = await client.rpc("mark_outbox_failed", {
    p_outbox_id: outbox.id,
    p_error: errorMessage,
    p_next_attempt_at: calculateNextAttemptAt(outbox.attempt_count),
    p_dead_letter: deadLetter,
  });

  if (error || !data) {
    logger.error("events.mark_failed_failed", {
      error,
      outbox_id: outbox.id,
    });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo marcar el evento como fallido"
    );
  }

  return data as OutboxEvent;
}

export async function recordInternalEventProcessing(
  client: Client,
  input: {
    outbox_id: string;
    event_type: string;
    consumer_name: string;
    status: InternalEventConsumerStatus;
    last_error?: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<InternalEventLog> {
  const { data, error } = await client.rpc("record_internal_event_processing", {
    p_outbox_id: input.outbox_id,
    p_event_type: input.event_type,
    p_consumer_name: input.consumer_name,
    p_status: input.status,
    p_last_error: input.last_error ?? undefined,
    p_metadata: toJson(input.metadata ?? {}),
  });

  if (error || !data) {
    logger.error("events.record_internal_processing_failed", {
      error,
      outbox_id: input.outbox_id,
      consumer_name: input.consumer_name,
    });
    throw new EventsRepositoryError(
      "EVENTS_REPOSITORY_ERROR",
      "No se pudo registrar el consumo del evento"
    );
  }

  return data as InternalEventLog;
}

function calculateNextAttemptAt(attemptCount: number): string {
  const delaysMs = [
    0,
    30_000,
    2 * 60_000,
    10 * 60_000,
    60 * 60_000,
  ];
  const delay = delaysMs[Math.min(attemptCount, delaysMs.length - 1)];
  return new Date(Date.now() + delay).toISOString();
}
