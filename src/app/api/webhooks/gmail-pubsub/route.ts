import { createHash } from "node:crypto";
import { z } from "zod";
import {
  GmailPubSubAuthError,
  verifyGmailPubSubRequest,
} from "@/adapters/email/pubsub-auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { enqueueGmailHistoryNotification } from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";
import { logger } from "@/shared/telemetry/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EnvelopeSchema = z.object({
  message: z.object({
    attributes: z.record(z.string(), z.string()).optional(),
    data: z.string().min(1).max(4096),
    messageId: z.string().min(1).max(160).optional(),
    message_id: z.string().min(1).max(160).optional(),
    orderingKey: z.string().max(1024).optional(),
    ordering_key: z.string().max(1024).optional(),
    publishTime: z.string().datetime({ offset: true }).optional(),
    publish_time: z.string().datetime({ offset: true }).optional(),
  }).passthrough().refine(
    (message) => Boolean(message.messageId || message.message_id),
    { message: "Pub/Sub message id is required" },
  ),
  subscription: z.string().max(500).optional(),
  deliveryAttempt: z.number().int().positive().optional(),
  delivery_attempt: z.number().int().positive().optional(),
}).passthrough();

const HistoryIdSchema = z.union([
  z.string().regex(/^\d{1,40}$/),
  z.number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .transform(String),
]);

const NotificationSchema = z.object({
  emailAddress: z.string().email().transform((value) => value.toLowerCase()),
  historyId: HistoryIdSchema,
}).strict();

const PubSubMessageIdSchema = z.string().min(1).max(160);
const PubSubPublishTimeSchema = z.string().datetime({ offset: true });
const PubSubSubscriptionSchema = z.string().max(500);

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    await verifyGmailPubSubRequest(request);
  } catch (error) {
    if (error instanceof GmailPubSubAuthError) {
      const status = error.code === "GMAIL_PUBSUB_CONFIGURATION_MISSING" ? 503 : 401;
      return errorJson(
        status === 503 ? "NOT_CONFIGURED" : "FORBIDDEN",
        "Webhook Gmail no autorizado.",
        meta,
        status,
      );
    }
    return errorJson("FORBIDDEN", "Webhook Gmail no autorizado.", meta, 401);
  }

  const rawBody = await request.text();
  try {
    const parsedBody: unknown = JSON.parse(rawBody);
    const payloadHash = createHash("sha256")
      .update(rawBody, "utf8")
      .digest("hex");
    const delivery = parsePubSubDelivery(request, parsedBody, payloadHash);
    const result = await enqueueGmailHistoryNotification(createServiceClient(), {
      emailAddress: delivery.notification.emailAddress,
      pubsubMessageId: delivery.messageId,
      historyId: delivery.notification.historyId,
      publishTime: delivery.publishTime,
      subscription: delivery.subscription,
      payloadHash,
      traceId: meta.trace_id,
    });
    return okJson(result, meta);
  } catch (error) {
    if (error instanceof SyntaxError || isZodLike(error)) {
      logger.warn("email.gmail_pubsub_payload_invalid", {
        body_kind: bodyKind(rawBody),
        top_level_keys: safeJsonKeys(rawBody),
        issue_paths: zodIssuePaths(error),
        delivery_shape: safeDeliveryShape(rawBody),
      });
      return validationError(error, meta, "Notificacion Gmail invalida.");
    }
    return unexpectedError(error, meta);
  }
}

function parsePubSubDelivery(
  request: Request,
  parsedBody: unknown,
  payloadHash: string,
) {
  const wrapped = EnvelopeSchema.safeParse(parsedBody);
  if (wrapped.success) {
    const decoded = Buffer.from(
      wrapped.data.message.data,
      "base64",
    ).toString("utf8");
    return {
      notification: NotificationSchema.parse(JSON.parse(decoded)),
      messageId:
        wrapped.data.message.messageId ??
        wrapped.data.message.message_id!,
      publishTime:
        wrapped.data.message.publishTime ??
        wrapped.data.message.publish_time ??
        null,
      subscription: wrapped.data.subscription ?? null,
    };
  }

  const notification = NotificationSchema.parse(parsedBody);
  const messageIdHeader = request.headers.get("x-goog-pubsub-message-id");
  const publishTimeHeader = request.headers.get("x-goog-pubsub-publish-time");
  const subscriptionHeader = request.headers.get(
    "x-goog-pubsub-subscription-name",
  );
  return {
    notification,
    messageId: messageIdHeader
      ? PubSubMessageIdSchema.parse(messageIdHeader)
      : `body-sha256-${payloadHash}`,
    publishTime: publishTimeHeader
      ? PubSubPublishTimeSchema.parse(publishTimeHeader)
      : null,
    subscription: subscriptionHeader
      ? PubSubSubscriptionSchema.parse(subscriptionHeader)
      : null,
  };
}

function bodyKind(rawBody: string): string {
  try {
    const value: unknown = JSON.parse(rawBody);
    if (Array.isArray(value)) return "array";
    return value === null ? "null" : typeof value;
  } catch {
    return "invalid_json";
  }
}

function safeJsonKeys(rawBody: string): string[] {
  try {
    const value: unknown = JSON.parse(rawBody);
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    return Object.keys(value)
      .filter((key) => /^[A-Za-z0-9_-]{1,80}$/.test(key))
      .sort()
      .slice(0, 20);
  } catch {
    return [];
  }
}

function safeDeliveryShape(rawBody: string) {
  try {
    const envelope: unknown = JSON.parse(rawBody);
    if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
      return { envelope_message: false };
    }
    const message = (envelope as Record<string, unknown>).message;
    if (!message || typeof message !== "object" || Array.isArray(message)) {
      return { envelope_message: false };
    }
    const data = (message as Record<string, unknown>).data;
    if (typeof data !== "string") {
      return { envelope_message: true, data_type: typeof data };
    }
    const decoded: unknown = JSON.parse(
      Buffer.from(data, "base64").toString("utf8"),
    );
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) {
      return {
        envelope_message: true,
        decoded_type: Array.isArray(decoded) ? "array" : typeof decoded,
      };
    }
    const record = decoded as Record<string, unknown>;
    return {
      envelope_message: true,
      decoded_keys: Object.keys(record)
        .filter((key) => /^[A-Za-z0-9_-]{1,80}$/.test(key))
        .sort()
        .slice(0, 20),
      email_address_type: typeof record.emailAddress,
      history_id_type: typeof record.historyId,
      history_id_length:
        typeof record.historyId === "string" ? record.historyId.length : null,
    };
  } catch {
    return { envelope_message: false, decoded_type: "invalid_json" };
  }
}

function zodIssuePaths(error: unknown): string[] {
  if (!isZodLike(error)) return [];
  return (error as { issues: Array<{ path?: PropertyKey[] }> }).issues
    .map((issue) => (issue.path ?? []).map(String).join("."))
    .filter(Boolean)
    .slice(0, 20);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
