import type { SupabaseClient } from "@supabase/supabase-js";
import { toJson } from "@/core/events/domain-events";
import type { Database } from "@/data/supabase/types";
import type { WhatsAppProvider } from "@/adapters/whatsapp/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type WhatsAppDeliveryStatus = "attempted" | "accepted" | "failed";
export type WhatsAppProviderDeliveryStatus =
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "unknown";

export type WhatsAppDeliveryAttempt =
  Database["public"]["Tables"]["whatsapp_delivery_attempts"]["Row"];

export type LinkedWhatsAppDeliveryReconciliation = {
  domain: "nudge" | null;
  nudge_delivery_reconciled: boolean;
  nudge_candidate_reconciled: boolean;
  insight_delivery_reconciled: boolean;
};

export class WhatsAppDeliveryRepositoryError extends Error {
  constructor(
    readonly code:
      | "WHATSAPP_DELIVERY_REPOSITORY_ERROR"
      | "WHATSAPP_DELIVERY_DUPLICATE",
    message: string
  ) {
    super(message);
    this.name = "WhatsAppDeliveryRepositoryError";
  }
}

export async function getWhatsAppDeliveryAttemptByIdempotencyKey(
  client: Client,
  input: {
    userId: string;
    idempotencyKey: string;
  }
): Promise<WhatsAppDeliveryAttempt | null> {
  const { data, error } = await client
    .from("whatsapp_delivery_attempts")
    .select("*")
    .eq("user_id", input.userId)
    .eq("idempotency_key", input.idempotencyKey)
    .maybeSingle();

  if (error) {
    logger.error("whatsapp.delivery_get_failed", {
      error,
      user_id: input.userId,
    });
    throw new WhatsAppDeliveryRepositoryError(
      "WHATSAPP_DELIVERY_REPOSITORY_ERROR",
      "No se pudo leer el intento WhatsApp"
    );
  }

  return (data as WhatsAppDeliveryAttempt | null) ?? null;
}

export async function createWhatsAppDeliveryAttempt(
  client: Client,
  input: {
    userId: string;
    provider: WhatsAppProvider;
    messageKind: "freeform" | "template" | "interactive";
    toPhone: string;
    templateName?: string | null;
    idempotencyKey: string;
    traceId: string;
    requestSummary?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
  }
): Promise<WhatsAppDeliveryAttempt> {
  const { data, error } = await client
    .from("whatsapp_delivery_attempts")
    .insert({
      user_id: input.userId,
      provider: input.provider,
      message_kind: input.messageKind,
      to_phone: input.toPhone,
      template_name: input.templateName ?? null,
      idempotency_key: input.idempotencyKey,
      trace_id: input.traceId,
      status: "attempted",
      request_summary: toJson(input.requestSummary ?? {}),
      metadata: toJson(input.metadata ?? {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    if (error?.code === "23505") {
      throw new WhatsAppDeliveryRepositoryError(
        "WHATSAPP_DELIVERY_DUPLICATE",
        "Intento WhatsApp duplicado"
      );
    }

    logger.error("whatsapp.delivery_create_failed", {
      error,
      user_id: input.userId,
    });
    throw new WhatsAppDeliveryRepositoryError(
      "WHATSAPP_DELIVERY_REPOSITORY_ERROR",
      "No se pudo crear el intento WhatsApp"
    );
  }

  return data as WhatsAppDeliveryAttempt;
}

export async function markWhatsAppDeliveryAccepted(
  client: Client,
  input: {
    userId: string;
    idempotencyKey: string;
    providerMessageId: string;
    httpStatus: number;
    latencyMs: number;
    responseSummary?: Record<string, unknown>;
  }
): Promise<WhatsAppDeliveryAttempt> {
  return updateDeliveryAttempt(client, input.userId, input.idempotencyKey, {
    status: "accepted",
    provider_message_id: input.providerMessageId,
    http_status: input.httpStatus,
    latency_ms: input.latencyMs,
    error_code: null,
    error_message: null,
    response_summary: toJson(input.responseSummary ?? {}),
  });
}

export async function markWhatsAppDeliveryFailed(
  client: Client,
  input: {
    userId: string;
    idempotencyKey: string;
    httpStatus?: number | null;
    latencyMs: number;
    errorCode: string;
    errorMessage: string;
    responseSummary?: Record<string, unknown>;
  }
): Promise<WhatsAppDeliveryAttempt> {
  return updateDeliveryAttempt(client, input.userId, input.idempotencyKey, {
    status: "failed",
    http_status: input.httpStatus ?? null,
    latency_ms: input.latencyMs,
    error_code: input.errorCode,
    error_message: input.errorMessage,
    response_summary: toJson(input.responseSummary ?? {}),
  });
}

export async function reconcileWhatsAppDeliveryStatusByProviderMessageId(
  client: Client,
  input: {
    userId: string;
    providerMessageId: string;
    deliveryStatus: WhatsAppProviderDeliveryStatus;
    receivedAt: string;
    traceId: string;
    conversationId?: string | null;
    pricingCategory?: string | null;
    errors?: Array<Record<string, unknown>>;
  }
): Promise<{
  reconciled: boolean;
  attempt: WhatsAppDeliveryAttempt | null;
}> {
  const { data, error } = await client
    .from("whatsapp_delivery_attempts")
    .select("*")
    .eq("user_id", input.userId)
    .eq("provider_message_id", input.providerMessageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.error("whatsapp.delivery_status_lookup_failed", {
      error,
      user_id: input.userId,
      provider_message_id: input.providerMessageId,
    });
    throw new WhatsAppDeliveryRepositoryError(
      "WHATSAPP_DELIVERY_REPOSITORY_ERROR",
      "No se pudo buscar el intento WhatsApp por provider_message_id"
    );
  }

  const attempt = (data as WhatsAppDeliveryAttempt | null) ?? null;
  if (!attempt) {
    return { reconciled: false, attempt: null };
  }

  const responseSummary = asRecord(attempt.response_summary);
  const attemptMetadata = asRecord(attempt.metadata);
  const responseStatus = readProviderDeliveryStatus(
    responseSummary.latest_delivery_status
  );
  const metadataStatus = readProviderDeliveryStatus(
    attemptMetadata.latest_delivery_status
  );
  const currentDeliveryStatus = nextProviderDeliveryStatus(
    responseStatus ?? "unknown",
    metadataStatus ?? "unknown"
  );
  const nextDeliveryStatus = nextProviderDeliveryStatus(
    currentDeliveryStatus,
    input.deliveryStatus
  );
  const incomingStatusIsCurrent =
    nextDeliveryStatus === input.deliveryStatus;
  const currentDeliveryStatusAt =
    responseStatus === currentDeliveryStatus
      ? readString(responseSummary.delivery_status_received_at)
      : metadataStatus === currentDeliveryStatus
        ? readString(attemptMetadata.last_delivery_status_at)
        : null;
  const currentDeliveryTraceId =
    metadataStatus === currentDeliveryStatus
      ? readString(attemptMetadata.last_delivery_trace_id)
      : null;
  const deliveryError = summarizeDeliveryError(input.errors ?? []);
  const patch: Database["public"]["Tables"]["whatsapp_delivery_attempts"]["Update"] =
    {
      status: nextAttemptStatus(attempt.status, nextDeliveryStatus),
      error_code:
        input.deliveryStatus === "failed"
          ? deliveryError.code
          : attempt.error_code,
      error_message:
        input.deliveryStatus === "failed"
          ? deliveryError.message
          : attempt.error_message,
      response_summary: toJson({
        ...responseSummary,
        latest_delivery_status: nextDeliveryStatus,
        delivery_status_received_at: incomingStatusIsCurrent
          ? input.receivedAt
          : currentDeliveryStatusAt ?? input.receivedAt,
        conversation_id: input.conversationId ?? null,
        pricing_category: input.pricingCategory ?? null,
        delivery_error_count: incomingStatusIsCurrent
          ? input.errors?.length ?? 0
          : readNumber(responseSummary.delivery_error_count) ?? 0,
        delivery_error_summary: incomingStatusIsCurrent
          ? deliveryError.summary
          : responseSummary.delivery_error_summary ?? null,
      }),
      metadata: toJson({
        ...attemptMetadata,
        latest_delivery_status: nextDeliveryStatus,
        last_delivery_status_at: incomingStatusIsCurrent
          ? input.receivedAt
          : currentDeliveryStatusAt ?? input.receivedAt,
        last_delivery_trace_id: incomingStatusIsCurrent
          ? input.traceId
          : currentDeliveryTraceId,
        last_delivery_event_status: input.deliveryStatus,
        last_delivery_event_at: input.receivedAt,
        last_delivery_event_trace_id: input.traceId,
      }),
    };

  const updated = await updateDeliveryAttemptById(
    client,
    input.userId,
    attempt.id,
    patch
  );

  return { reconciled: true, attempt: updated };
}

export async function reconcileLinkedWhatsAppDeliveryStatus(
  client: Client,
  input: {
    attempt: WhatsAppDeliveryAttempt;
    deliveryStatus: WhatsAppProviderDeliveryStatus;
    receivedAt: string;
    traceId: string;
    errors?: Array<Record<string, unknown>>;
  }
): Promise<LinkedWhatsAppDeliveryReconciliation> {
  const metadata = asRecord(input.attempt.metadata);
  if (readString(metadata.delivery_domain) !== "nudge") {
    return emptyLinkedReconciliation();
  }

  const nudgeDeliveryId = readString(metadata.nudge_delivery_id);
  const nudgeCandidateId = readString(metadata.nudge_candidate_id);
  const insightCandidateId = readString(metadata.insight_candidate_id);
  const result: LinkedWhatsAppDeliveryReconciliation = {
    domain: "nudge",
    nudge_delivery_reconciled: false,
    nudge_candidate_reconciled: false,
    insight_delivery_reconciled: false,
  };

  if (input.deliveryStatus === "unknown") return result;

  if (nudgeDeliveryId) {
    result.nudge_delivery_reconciled = await reconcileNudgeDelivery(client, {
      userId: input.attempt.user_id,
      deliveryId: nudgeDeliveryId,
      deliveryStatus: input.deliveryStatus,
      receivedAt: input.receivedAt,
      traceId: input.traceId,
      errors: input.errors ?? [],
    });
  }

  if (nudgeCandidateId) {
    result.nudge_candidate_reconciled = await reconcileNudgeCandidate(client, {
      userId: input.attempt.user_id,
      candidateId: nudgeCandidateId,
      deliveryStatus: input.deliveryStatus,
      receivedAt: input.receivedAt,
      traceId: input.traceId,
      errors: input.errors ?? [],
    });
  }

  if (insightCandidateId && input.attempt.provider_message_id) {
    result.insight_delivery_reconciled = await reconcileInsightDelivery(client, {
      userId: input.attempt.user_id,
      insightCandidateId,
      providerMessageId: input.attempt.provider_message_id,
      deliveryStatus: input.deliveryStatus,
      receivedAt: input.receivedAt,
      traceId: input.traceId,
      errors: input.errors ?? [],
    });
  }

  return result;
}

export function nextNudgeDeliveryStatus(
  currentStatus: string,
  providerStatus: WhatsAppProviderDeliveryStatus
): Database["public"]["Enums"]["nudge_status"] {
  if (["responded", "acted", "dismissed", "expired"].includes(currentStatus)) {
    return currentStatus as Database["public"]["Enums"]["nudge_status"];
  }
  if (providerStatus === "failed") {
    return currentStatus === "delivered" ? "delivered" : "failed";
  }
  if (providerStatus === "delivered" || providerStatus === "read") {
    return "delivered";
  }
  if (providerStatus === "sent") {
    return currentStatus === "delivered" ? "delivered" : "sent";
  }
  return currentStatus as Database["public"]["Enums"]["nudge_status"];
}

export function nextInsightDeliveryStatus(
  currentStatus: string,
  providerStatus: WhatsAppProviderDeliveryStatus
): "planned" | "sent" | "delivered" | "seen" | "failed" {
  if (currentStatus === "seen") return "seen";
  if (providerStatus === "failed") {
    return currentStatus === "delivered" ? "delivered" : "failed";
  }
  if (providerStatus === "read") return "seen";
  if (providerStatus === "delivered") return "delivered";
  if (providerStatus === "sent") {
    return currentStatus === "delivered" ? "delivered" : "sent";
  }
  return isInsightDeliveryStatus(currentStatus) ? currentStatus : "planned";
}

async function reconcileNudgeDelivery(
  client: Client,
  input: {
    userId: string;
    deliveryId: string;
    deliveryStatus: WhatsAppProviderDeliveryStatus;
    receivedAt: string;
    traceId: string;
    errors: Array<Record<string, unknown>>;
  }
): Promise<boolean> {
  const { data, error } = await client
    .from("nudge_deliveries")
    .select("*")
    .eq("id", input.deliveryId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error) throwLinkedReconciliationError("nudge_delivery_lookup", error);
  if (!data) return false;

  const nextStatus = nextNudgeDeliveryStatus(data.status, input.deliveryStatus);
  const deliveredAt =
    ["delivered", "read"].includes(input.deliveryStatus) &&
    nextStatus === "delivered"
      ? data.delivered_at ?? input.receivedAt
      : data.delivered_at;
  const deliveryError = summarizeDeliveryError(input.errors);
  const { error: updateError } = await client
    .from("nudge_deliveries")
    .update({
      status: nextStatus,
      delivered_at: deliveredAt,
      metadata: toJson({
        ...asRecord(data.metadata),
        latest_provider_status: input.deliveryStatus,
        latest_provider_status_at: input.receivedAt,
        latest_provider_trace_id: input.traceId,
        ...(input.deliveryStatus === "read" ? { read_at: input.receivedAt } : {}),
        ...(input.deliveryStatus === "failed"
          ? { delivery_error: deliveryError.summary }
          : {}),
      }),
    })
    .eq("id", input.deliveryId)
    .eq("user_id", input.userId);
  if (updateError) throwLinkedReconciliationError("nudge_delivery_update", updateError);
  return true;
}

async function reconcileNudgeCandidate(
  client: Client,
  input: {
    userId: string;
    candidateId: string;
    deliveryStatus: WhatsAppProviderDeliveryStatus;
    receivedAt: string;
    traceId: string;
    errors: Array<Record<string, unknown>>;
  }
): Promise<boolean> {
  const { data, error } = await client
    .from("nudge_candidates")
    .select("*")
    .eq("id", input.candidateId)
    .eq("user_id", input.userId)
    .maybeSingle();
  if (error) throwLinkedReconciliationError("nudge_candidate_lookup", error);
  if (!data) return false;

  const terminal = ["responded", "acted", "dismissed", "expired"].includes(
    data.status
  );
  const failed = input.deliveryStatus === "failed" && !terminal && data.status !== "delivered";
  const nextStatus = failed
    ? "deferred"
    : nextNudgeDeliveryStatus(data.status, input.deliveryStatus);
  const retryAt = failed
    ? new Date(new Date(input.receivedAt).getTime() + 60 * 60_000).toISOString()
    : data.scheduled_for;
  const deliveryError = summarizeDeliveryError(input.errors);
  const { error: updateError } = await client
    .from("nudge_candidates")
    .update({
      status: nextStatus,
      scheduled_for: retryAt,
      metadata: toJson({
        ...asRecord(data.metadata),
        latest_provider_status: input.deliveryStatus,
        latest_provider_status_at: input.receivedAt,
        latest_provider_trace_id: input.traceId,
        ...(failed
          ? {
              retry_at: retryAt,
              delivery_error: deliveryError.summary,
            }
          : {}),
      }),
    })
    .eq("id", input.candidateId)
    .eq("user_id", input.userId);
  if (updateError) throwLinkedReconciliationError("nudge_candidate_update", updateError);
  return true;
}

async function reconcileInsightDelivery(
  client: Client,
  input: {
    userId: string;
    insightCandidateId: string;
    providerMessageId: string;
    deliveryStatus: WhatsAppProviderDeliveryStatus;
    receivedAt: string;
    traceId: string;
    errors: Array<Record<string, unknown>>;
  }
): Promise<boolean> {
  const { data, error } = await client
    .from("insight_deliveries")
    .select("*")
    .eq("user_id", input.userId)
    .eq("insight_candidate_id", input.insightCandidateId)
    .eq("channel", "whatsapp")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throwLinkedReconciliationError("insight_delivery_lookup", error);
  const delivery = (data ?? []).find(
    (row) =>
      readString(asRecord(row.metadata).provider_message_id) ===
      input.providerMessageId
  );
  if (!delivery) return false;

  const nextStatus = nextInsightDeliveryStatus(
    delivery.status,
    input.deliveryStatus
  );
  const deliveredAt =
    ["delivered", "read"].includes(input.deliveryStatus) &&
    ["delivered", "seen"].includes(nextStatus)
      ? delivery.delivered_at ?? input.receivedAt
      : delivery.delivered_at;
  const seenAt =
    input.deliveryStatus === "read" && nextStatus === "seen"
      ? delivery.seen_at ?? input.receivedAt
      : delivery.seen_at;
  const deliveryError = summarizeDeliveryError(input.errors);
  const { error: updateError } = await client
    .from("insight_deliveries")
    .update({
      status: nextStatus,
      delivered_at: deliveredAt,
      seen_at: seenAt,
      metadata: toJson({
        ...asRecord(delivery.metadata),
        latest_provider_status: input.deliveryStatus,
        latest_provider_status_at: input.receivedAt,
        latest_provider_trace_id: input.traceId,
        ...(input.deliveryStatus === "failed"
          ? { delivery_error: deliveryError.summary }
          : {}),
      }),
    })
    .eq("id", delivery.id)
    .eq("user_id", input.userId);
  if (updateError) throwLinkedReconciliationError("insight_delivery_update", updateError);
  return true;
}

async function updateDeliveryAttempt(
  client: Client,
  userId: string,
  idempotencyKey: string,
  patch: Database["public"]["Tables"]["whatsapp_delivery_attempts"]["Update"]
): Promise<WhatsAppDeliveryAttempt> {
  const { data, error } = await client
    .from("whatsapp_delivery_attempts")
    .update(patch)
    .eq("user_id", userId)
    .eq("idempotency_key", idempotencyKey)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("whatsapp.delivery_update_failed", {
      error,
      user_id: userId,
    });
    throw new WhatsAppDeliveryRepositoryError(
      "WHATSAPP_DELIVERY_REPOSITORY_ERROR",
      "No se pudo actualizar el intento WhatsApp"
    );
  }

  return data as WhatsAppDeliveryAttempt;
}

async function updateDeliveryAttemptById(
  client: Client,
  userId: string,
  attemptId: string,
  patch: Database["public"]["Tables"]["whatsapp_delivery_attempts"]["Update"]
): Promise<WhatsAppDeliveryAttempt> {
  const { data, error } = await client
    .from("whatsapp_delivery_attempts")
    .update(patch)
    .eq("user_id", userId)
    .eq("id", attemptId)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("whatsapp.delivery_status_update_failed", {
      error,
      user_id: userId,
      attempt_id: attemptId,
    });
    throw new WhatsAppDeliveryRepositoryError(
      "WHATSAPP_DELIVERY_REPOSITORY_ERROR",
      "No se pudo reconciliar el status WhatsApp"
    );
  }

  return data as WhatsAppDeliveryAttempt;
}

function nextAttemptStatus(
  current: string,
  deliveryStatus: WhatsAppProviderDeliveryStatus
): WhatsAppDeliveryStatus {
  if (deliveryStatus === "failed") return "failed";
  if (current === "failed") return "failed";
  return "accepted";
}

export function nextProviderDeliveryStatus(
  current: WhatsAppProviderDeliveryStatus,
  incoming: WhatsAppProviderDeliveryStatus
): WhatsAppProviderDeliveryStatus {
  if (current === "failed" || incoming === "failed") return "failed";

  const rank: Record<WhatsAppProviderDeliveryStatus, number> = {
    unknown: 0,
    sent: 1,
    delivered: 2,
    read: 3,
    failed: 4,
  };

  return rank[incoming] >= rank[current] ? incoming : current;
}

function summarizeDeliveryError(errors: Array<Record<string, unknown>>): {
  code: string;
  message: string;
  summary: Record<string, unknown> | null;
} {
  const firstError = errors[0];
  if (!firstError) {
    return {
      code: "WHATSAPP_DELIVERY_FAILED",
      message: "El proveedor WhatsApp reporto fallo de entrega.",
      summary: null,
    };
  }

  const code = readString(firstError.code) ?? "WHATSAPP_DELIVERY_FAILED";
  const title = readString(firstError.title);
  const message =
    readString(firstError.message) ??
    title ??
    "El proveedor WhatsApp reporto fallo de entrega.";

  return {
    code,
    message,
    summary: {
      code,
      title,
      message,
    },
  };
}

function emptyLinkedReconciliation(): LinkedWhatsAppDeliveryReconciliation {
  return {
    domain: null,
    nudge_delivery_reconciled: false,
    nudge_candidate_reconciled: false,
    insight_delivery_reconciled: false,
  };
}

function isInsightDeliveryStatus(
  value: string
): value is "planned" | "sent" | "delivered" | "seen" | "failed" {
  return ["planned", "sent", "delivered", "seen", "failed"].includes(value);
}

function throwLinkedReconciliationError(operation: string, error: unknown): never {
  logger.error("whatsapp.linked_delivery_reconciliation_failed", {
    operation,
    error,
  });
  throw new WhatsAppDeliveryRepositoryError(
    "WHATSAPP_DELIVERY_REPOSITORY_ERROR",
    "No se pudo reconciliar la entrega vinculada"
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readProviderDeliveryStatus(
  value: unknown
): WhatsAppProviderDeliveryStatus | null {
  const status = readString(value);
  if (
    status === "sent" ||
    status === "delivered" ||
    status === "read" ||
    status === "failed" ||
    status === "unknown"
  ) {
    return status;
  }
  return null;
}
