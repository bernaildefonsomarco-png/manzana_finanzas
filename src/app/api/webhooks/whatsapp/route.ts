import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  buildWhatsAppMessageIdempotencyKey,
  buildWhatsAppStatusIdempotencyKey,
  normalizeKapsoWebhook,
  normalizeMetaCloudWebhook,
  normalizeYCloudWebhook,
  verifyKapsoWebhookSignature,
  verifyMetaWebhookChallenge,
  verifyMetaWebhookSignature,
  verifyYCloudWebhookSignature,
  type InboundWhatsAppEvent,
  type WhatsAppProvider,
  type WhatsAppStatusEvent,
} from "@/adapters/whatsapp";
import { getTraceId } from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";
import {
  appendOutboxEvent,
  EventsRepositoryError,
  getExternalEventByIdempotencyKey,
  recordExternalEvent,
} from "@/data/repositories/events.repository";
import type { ExternalEventLog } from "@/core/events/domain-events";
import {
  findUserIdByWhatsAppPhone,
  touchWhatsAppWindowFromInbound,
} from "@/data/repositories/whatsapp-window.repository";
import {
  reconcileLinkedWhatsAppDeliveryStatus,
  reconcileWhatsAppDeliveryStatusByProviderMessageId,
} from "@/data/repositories/whatsapp-delivery.repository";
import { logger } from "@/shared/telemetry/logger";
import { createDefaultOutboxHandlers } from "@/workers/outbox/default-handlers";
import {
  publishOutboxBatch,
  type OutboxPublisherResult,
} from "@/workers/outbox/outbox-publisher";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type WebhookResult = {
  inbound_received: number;
  statuses_received: number;
  statuses_reconciled: number;
  duplicates: number;
  unknown_users: number;
  handoffs_enqueued: number;
  auto_drain: WebhookAutoDrainResult | null;
};

type WebhookAutoDrainResult = OutboxPublisherResult & {
  status: "processed" | "failed";
  error_code: string | null;
};

export async function GET(request: Request) {
  const challenge = verifyMetaWebhookChallenge(
    new URL(request.url).searchParams,
    getWhatsAppVerifyToken()
  );

  if (!challenge) {
    return new Response("Forbidden", { status: 403 });
  }

  return new Response(challenge, {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const rawBody = await request.text();

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "VALIDATION_ERROR", message: "JSON invalido." },
        meta: { trace_id },
      },
      { status: 400 }
    );
  }

  const provider = detectWebhookProvider(request, payload);
  const signature = getProviderSignature(request, provider);

  if (!isValidSignature(rawBody, provider, signature)) {
    logger.warn("whatsapp.webhook_invalid_signature", { trace_id, provider });
    return NextResponse.json(
      {
        ok: false,
        error: { code: "FORBIDDEN", message: "Webhook no autorizado." },
        meta: { trace_id },
      },
      { status: 401 }
    );
  }

  const normalized =
    provider === "kapso"
      ? normalizeKapsoWebhook(payload, request.headers.get("x-webhook-event"))
      : provider === "ycloud"
        ? normalizeYCloudWebhook(payload)
        : normalizeMetaCloudWebhook(payload);
  const serviceClient = createServiceClient();
  const result: WebhookResult = {
    inbound_received: 0,
    statuses_received: 0,
    statuses_reconciled: 0,
    duplicates: 0,
    unknown_users: 0,
    handoffs_enqueued: 0,
    auto_drain: null,
  };

  try {
    for (const message of normalized.inboundMessages) {
      const userId = await findUserIdByWhatsAppPhone(
        serviceClient,
        message.fromPhone
      );
      if (!userId) result.unknown_users += 1;

      const recordedEvent = await recordInboundMessage({
        message,
        traceId: trace_id,
        userId,
        serviceClient,
      });

      if (!recordedEvent) {
        result.duplicates += 1;
        if (userId) {
          const existingEvent = await getExternalEventByIdempotencyKey(
            serviceClient,
            {
              source: "whatsapp",
              idempotency_key: buildWhatsAppMessageIdempotencyKey(message),
            }
          );
          if (existingEvent) {
            const enqueued = await enqueueWhatsAppInboundHandoff({
              message,
              externalEvent: existingEvent,
              traceId: trace_id,
              serviceClient,
            });
            if (enqueued) result.handoffs_enqueued += 1;
          }
        }
        continue;
      }

      result.inbound_received += 1;

      if (userId) {
        await touchWhatsAppWindowFromInbound(serviceClient, {
          userId,
          phone: message.fromPhone,
          receivedAt: message.receivedAt,
          traceId: trace_id,
          providerMessageId: message.providerMessageId,
        });

        const enqueued = await enqueueWhatsAppInboundHandoff({
          message,
          externalEvent: recordedEvent,
          traceId: trace_id,
          serviceClient,
        });
        if (enqueued) result.handoffs_enqueued += 1;
      }
    }

    for (const status of normalized.statuses) {
      const userId = status.recipientPhone
        ? await findUserIdByWhatsAppPhone(serviceClient, status.recipientPhone)
        : null;
      if (!userId) result.unknown_users += 1;

      const recorded = await recordStatusEvent({
        status,
        traceId: trace_id,
        userId,
        serviceClient,
      });

      if (!recorded) {
        result.duplicates += 1;
      } else {
        result.statuses_received += 1;
      }

      if (userId) {
        const reconciliation =
          await reconcileWhatsAppDeliveryStatusByProviderMessageId(
            serviceClient,
            {
              userId,
              providerMessageId: status.providerMessageId,
              deliveryStatus: status.status,
              receivedAt: status.receivedAt,
              traceId: trace_id,
              conversationId: status.conversationId,
              pricingCategory: status.pricingCategory,
              errors: status.errors,
            }
          );
        if (reconciliation.reconciled) {
          result.statuses_reconciled += 1;
          if (reconciliation.attempt) {
            await reconcileLinkedWhatsAppDeliveryStatus(serviceClient, {
              attempt: reconciliation.attempt,
              deliveryStatus: status.status,
              receivedAt: status.receivedAt,
              traceId: trace_id,
              errors: status.errors,
            });
          }
        }
      }
    }
  } catch (error) {
    logger.error("whatsapp.webhook_record_failed", { error, trace_id });
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "No se pudo registrar el webhook.",
        },
        meta: { trace_id },
      },
      { status: 500 }
    );
  }

  if (shouldAutoDrainOutbox(result)) {
    result.auto_drain = await autoDrainOutbox(serviceClient, trace_id);
  }

  logger.info("whatsapp.webhook_received", {
    trace_id,
    inbound_received: result.inbound_received,
    statuses_received: result.statuses_received,
    statuses_reconciled: result.statuses_reconciled,
    duplicates: result.duplicates,
    unknown_users: result.unknown_users,
    handoffs_enqueued: result.handoffs_enqueued,
    auto_drain: result.auto_drain,
  });

  return NextResponse.json({
    ok: true,
    data: result,
    meta: { trace_id },
  });
}

function shouldAutoDrainOutbox(result: WebhookResult): boolean {
  return (
    process.env.OUTBOX_AUTO_DRAIN_ON_WEBHOOK === "true" &&
    result.handoffs_enqueued > 0
  );
}

async function autoDrainOutbox(
  serviceClient: ReturnType<typeof createServiceClient>,
  traceId: string
): Promise<WebhookAutoDrainResult> {
  try {
    const result: OutboxPublisherResult = {
      claimed: 0,
      published: 0,
      failed: 0,
      skipped: 0,
    };
    const maxPasses = getAutoDrainMaxPasses();

    for (let pass = 0; pass < maxPasses; pass += 1) {
      const passResult = await publishOutboxBatch(serviceClient, {
        limit: getAutoDrainLimit(),
        handlers: createDefaultOutboxHandlers(serviceClient),
      });

      result.claimed += passResult.claimed;
      result.published += passResult.published;
      result.failed += passResult.failed;
      result.skipped += passResult.skipped;

      if (passResult.claimed === 0 || passResult.failed > 0) {
        break;
      }
    }

    return {
      ...result,
      status: "processed",
      error_code: null,
    };
  } catch (error) {
    logger.error("whatsapp.webhook_auto_drain_failed", {
      trace_id: traceId,
      error,
    });

    return {
      claimed: 0,
      published: 0,
      failed: 1,
      skipped: 0,
      status: "failed",
      error_code: "OUTBOX_AUTO_DRAIN_FAILED",
    };
  }
}

function getAutoDrainLimit(): number {
  const rawLimit = Number(process.env.OUTBOX_AUTO_DRAIN_LIMIT ?? 10);
  if (!Number.isInteger(rawLimit)) return 10;
  return Math.min(Math.max(rawLimit, 1), 25);
}

function getAutoDrainMaxPasses(): number {
  const rawPasses = Number(process.env.OUTBOX_AUTO_DRAIN_MAX_PASSES ?? 3);
  if (!Number.isInteger(rawPasses)) return 3;
  return Math.min(Math.max(rawPasses, 1), 5);
}

function detectWebhookProvider(
  request: Request,
  payload: unknown
): WhatsAppProvider {
  if (request.headers.get("ycloud-signature")) return "ycloud";
  if (
    request.headers.get("x-webhook-signature") ||
    request.headers.get("x-webhook-event")
  ) {
    return "kapso";
  }
  if (request.headers.get("x-hub-signature-256")) return "meta_cloud";

  if (isRecord(payload)) {
    const type = payload.type;
    if (typeof type === "string" && type.startsWith("whatsapp.")) {
      return "ycloud";
    }
    if (payload.object === "whatsapp_business_account") {
      return process.env.WHATSAPP_PROVIDER === "kapso" ? "kapso" : "meta_cloud";
    }
  }

  if (process.env.WHATSAPP_PROVIDER === "meta_cloud") return "meta_cloud";
  if (process.env.WHATSAPP_PROVIDER === "ycloud") return "ycloud";
  return "kapso";
}

function getProviderSignature(
  request: Request,
  provider: WhatsAppProvider
): string | null {
  if (provider === "ycloud") return request.headers.get("ycloud-signature");
  if (provider === "kapso") return request.headers.get("x-webhook-signature");
  return request.headers.get("x-hub-signature-256");
}

function isValidSignature(
  rawBody: string,
  provider: WhatsAppProvider,
  signature: string | null
): boolean {
  if (provider === "kapso") {
    const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET;
    const appEnv = process.env.APP_ENV ?? "local";
    const requireSignature =
      Boolean(webhookSecret) || appEnv === "production" || appEnv === "staging";

    return verifyKapsoWebhookSignature(rawBody, signature, webhookSecret, {
      requireSignature,
    });
  }

  if (provider === "ycloud") {
    const webhookSecret = process.env.YCLOUD_WEBHOOK_SECRET;
    const appEnv = process.env.APP_ENV ?? "local";
    const requireSignature =
      Boolean(webhookSecret) || appEnv === "production" || appEnv === "staging";

    return verifyYCloudWebhookSignature(rawBody, signature, webhookSecret, {
      requireSignature,
    });
  }

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const appEnv = process.env.APP_ENV ?? "local";
  const requireSignature =
    Boolean(appSecret) || appEnv === "production" || appEnv === "staging";

  return verifyMetaWebhookSignature(rawBody, signature, appSecret, {
    requireSignature,
  });
}

function getWhatsAppVerifyToken(): string | undefined {
  return (
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? process.env.WHATSAPP_VERIFY_TOKEN
  );
}

async function recordInboundMessage(input: {
  message: InboundWhatsAppEvent;
  traceId: string;
  userId: string | null;
  serviceClient: ReturnType<typeof createServiceClient>;
}): Promise<ExternalEventLog | null> {
  const metadata = {
    provider: input.message.provider,
    direction: "inbound",
    wa_phone_number_id: input.message.waPhoneNumberId,
    provider_message_id: input.message.providerMessageId,
    provider_thread_id: input.message.providerThreadId,
    from_phone: input.message.fromPhone,
    to_phone: input.message.toPhone,
    message_type: input.message.messageType,
    text: input.message.text,
    payload: input.message.payload,
  };

  return recordExternalEventSafely(input.serviceClient, {
    event_type: "whatsapp.message_received",
    idempotency_key: buildWhatsAppMessageIdempotencyKey(input.message),
    user_id: input.userId,
    payload_hash: hashPayload(metadata),
    trace_id: input.traceId,
    metadata,
  });
}

async function recordStatusEvent(input: {
  status: WhatsAppStatusEvent;
  traceId: string;
  userId: string | null;
  serviceClient: ReturnType<typeof createServiceClient>;
}): Promise<boolean> {
  const metadata = {
    provider: input.status.provider,
    direction: "status",
    wa_phone_number_id: input.status.waPhoneNumberId,
    provider_message_id: input.status.providerMessageId,
    recipient_phone: input.status.recipientPhone,
    delivery_status: input.status.status,
    conversation_id: input.status.conversationId,
    pricing_category: input.status.pricingCategory,
    errors: input.status.errors,
    normalized_payload_version: 1,
  };

  const event = await recordExternalEventSafely(input.serviceClient, {
    event_type: "whatsapp.delivery_status_received",
    idempotency_key: buildWhatsAppStatusIdempotencyKey(input.status),
    user_id: input.userId,
    payload_hash: hashPayload(metadata),
    trace_id: input.traceId,
    metadata,
  });
  return Boolean(event);
}

async function recordExternalEventSafely(
  serviceClient: ReturnType<typeof createServiceClient>,
  input: {
    event_type: string;
    idempotency_key: string;
    user_id: string | null;
    payload_hash: string;
    trace_id: string;
    metadata: Record<string, unknown>;
  }
): Promise<ExternalEventLog | null> {
  try {
    return await recordExternalEvent(serviceClient, {
      source: "whatsapp",
      event_type: input.event_type,
      idempotency_key: input.idempotency_key,
      user_id: input.user_id,
      payload_hash: input.payload_hash,
      payload_ref: null,
      trace_id: input.trace_id || randomUUID(),
      metadata: input.metadata,
    });
  } catch (error) {
    if (
      error instanceof EventsRepositoryError &&
      error.code === "EXTERNAL_EVENT_DUPLICATE"
    ) {
      return null;
    }

    throw error;
  }
}

async function enqueueWhatsAppInboundHandoff(input: {
  message: InboundWhatsAppEvent;
  externalEvent: ExternalEventLog;
  traceId: string;
  serviceClient: ReturnType<typeof createServiceClient>;
}): Promise<boolean> {
  if (!input.externalEvent.user_id) return false;

  try {
    await appendOutboxEvent(input.serviceClient, {
      id: input.externalEvent.id,
      user_id: input.externalEvent.user_id,
      event_type: "whatsapp.message_received",
      aggregate_type: "external_event",
      aggregate_id: input.externalEvent.id,
      payload_version: 1,
      trace_id: input.traceId || randomUUID(),
      status: "pending",
      payload: {
        external_event_id: input.externalEvent.id,
        provider_message_id: input.message.providerMessageId,
        message_type: input.message.messageType,
      },
      metadata: {
        source: "whatsapp",
        handoff: "financial_orchestrator",
      },
    });
    return true;
  } catch (error) {
    if (
      error instanceof EventsRepositoryError &&
      error.code === "OUTBOX_EVENT_DUPLICATE"
    ) {
      return false;
    }

    throw error;
  }
}

function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
