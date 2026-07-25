import { createHmac, timingSafeEqual } from "node:crypto";
import {
  normalizeMetaCloudWebhook,
  normalizePhone,
} from "./meta-cloud-adapter";
import type {
  InboundWhatsAppEvent,
  NormalizedWhatsAppWebhook,
  WhatsAppMessageType,
  WhatsAppStatusEvent,
} from "./types";

type KapsoWebhookPayload = {
  id?: string;
  event?: string;
  type?: string;
  data?: unknown;
  message?: unknown;
  conversation?: unknown;
  phone_number_id?: string;
  [key: string]: unknown;
};

type KapsoRawStatus = {
  id?: string;
  status?: string;
  timestamp?: string | number;
  recipient_id?: string;
  pricing?: { category?: string };
  errors?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

type KapsoMessage = {
  id?: string;
  wamid?: string;
  from?: string;
  to?: string;
  timestamp?: string | number;
  createdAt?: string;
  phoneNumberId?: string;
  phone_number_id?: string;
  wabaId?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string; description?: string };
  };
  image?: Record<string, unknown>;
  audio?: Record<string, unknown>;
  document?: Record<string, unknown>;
  status?: string;
  recipient_id?: string;
  conversation?: { id?: string; origin?: { type?: string }; originType?: string };
  pricing?: { category?: string };
  pricingCategory?: string;
  errors?: Array<Record<string, unknown>>;
  error?: Record<string, unknown>;
  kapso?: {
    direction?: string;
    status?: string;
    processing_status?: string;
    statuses?: KapsoRawStatus[];
    [key: string]: unknown;
  };
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  [key: string]: unknown;
};

export function verifyKapsoWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
  options: { requireSignature: boolean }
): boolean {
  if (!options.requireSignature && !webhookSecret) return true;
  if (!webhookSecret || !signatureHeader) return false;

  const received = normalizeSignature(signatureHeader);
  if (!received) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function normalizeKapsoWebhook(
  payload: unknown,
  eventType?: string | null
): NormalizedWhatsAppWebhook {
  if (!isRecord(payload)) return { inboundMessages: [], statuses: [] };

  if (isMetaCompatiblePayload(payload)) {
    return remapProvider(normalizeMetaCloudWebhook(payload));
  }

  const body = payload as KapsoWebhookPayload;
  const rawEvent = eventType ?? readString(body.event) ?? readString(body.type);
  const event = normalizeKapsoEvent(rawEvent);
  const data = readRecord(body.data) ?? readRecord(body.message) ?? body;
  const message = data as KapsoMessage;
  const providerMessageId =
    readString(message.id) ?? readString(message.wamid) ?? readString(body.id);

  if (!providerMessageId) return { inboundMessages: [], statuses: [] };

  if (isStatusEvent(event, message)) {
    return {
      inboundMessages: [],
      statuses: [
        buildStatusEvent(
          event,
          rawEvent,
          message,
          providerMessageId,
          body,
        ),
      ],
    };
  }

  if (!message.from) return { inboundMessages: [], statuses: [] };

  return {
    inboundMessages: [buildInboundEvent(event, message, providerMessageId, body)],
    statuses: [],
  };
}

function buildInboundEvent(
  event: string | null,
  message: KapsoMessage,
  providerMessageId: string,
  body: KapsoWebhookPayload
): InboundWhatsAppEvent {
  const phoneNumberId =
    readString(message.phoneNumberId) ??
    readString(message.phone_number_id) ??
    readString(message.metadata?.phone_number_id) ??
    readString(body.phone_number_id) ??
    readString(readRecord(body.conversation)?.phone_number_id) ??
    readString(message.wabaId) ??
    "";
  const conversation = readRecord(body.conversation);

  return {
    provider: "kapso",
    providerMessageId,
    providerThreadId:
      readString(body.id) ??
      readString(conversation?.id) ??
      readString(message.wabaId),
    waPhoneNumberId: phoneNumberId,
    fromPhone: normalizePhone(message.from ?? ""),
    toPhone: normalizePhone(
      readString(message.to) ??
        readString(message.metadata?.display_phone_number) ??
        phoneNumberId
    ),
    receivedAt: timestampToIso(message.timestamp ?? message.createdAt),
    messageType: mapMessageType(message.type),
    text: extractText(message),
    payload: {
      event_type: event,
      message,
    },
  };
}

function buildStatusEvent(
  event: string | null,
  rawEvent: string | null,
  message: KapsoMessage,
  providerMessageId: string,
  body: KapsoWebhookPayload
): WhatsAppStatusEvent {
  const latestStatus = latestKapsoStatus(message);
  const status = mapStatus(
    readString(message.status) ??
      readString(message.kapso?.status) ??
      readString(latestStatus?.status) ??
      event?.replace("message.", "")
  );
  const conversation = readRecord(body.conversation);
  const phoneNumberId =
    readString(message.phoneNumberId) ??
    readString(message.phone_number_id) ??
    readString(message.metadata?.phone_number_id) ??
    readString(body.phone_number_id) ??
    readString(conversation?.phone_number_id) ??
    readString(message.wabaId) ??
    "";
  const recipientPhone =
    readString(message.to) ??
    readString(message.recipient_id) ??
    readString(latestStatus?.recipient_id) ??
    readString(conversation?.phone_number) ??
    "";
  const errors = extractErrors(message, latestStatus);

  return {
    provider: "kapso",
    providerMessageId,
    waPhoneNumberId: phoneNumberId,
    recipientPhone: normalizePhone(recipientPhone),
    status,
    receivedAt: timestampToIso(
      latestStatus?.timestamp ?? message.timestamp ?? message.createdAt
    ),
    conversationId:
      message.conversation?.id ?? readString(conversation?.id) ?? null,
    pricingCategory:
      message.pricing?.category ??
      latestStatus?.pricing?.category ??
      message.pricingCategory ??
      message.conversation?.origin?.type ??
      message.conversation?.originType ??
      null,
    errors,
    payload: {
      event_id: readString(body.id),
      event_type: rawEvent ?? event,
      message: {
        id: providerMessageId,
        timestamp:
          latestStatus?.timestamp ?? message.timestamp ?? message.createdAt ?? null,
        status,
        recipient_id: recipientPhone || null,
        has_errors: errors.length > 0,
      },
    },
  };
}

function remapProvider(
  normalized: NormalizedWhatsAppWebhook
): NormalizedWhatsAppWebhook {
  return {
    inboundMessages: normalized.inboundMessages.map((message) => ({
      ...message,
      provider: "kapso",
    })),
    statuses: normalized.statuses.map((status) => ({
      ...status,
      provider: "kapso",
    })),
  };
}

function isMetaCompatiblePayload(payload: Record<string, unknown>): boolean {
  return (
    payload.object === "whatsapp_business_account" || Array.isArray(payload.entry)
  );
}

function isStatusEvent(event: string | null, message: KapsoMessage): boolean {
  if (event) {
    return ["message.sent", "message.delivered", "message.read", "message.failed"].includes(
      event
    );
  }

  return Boolean(
    (message.status || message.kapso?.status || latestKapsoStatus(message)?.status) &&
      !message.from
  );
}

function normalizeKapsoEvent(event: string | null): string | null {
  const normalized = event?.trim().toLowerCase() ?? null;
  if (!normalized) return null;
  return normalized.startsWith("whatsapp.message.")
    ? normalized.slice("whatsapp.".length)
    : normalized;
}

function normalizeSignature(header: string): string | null {
  const value = header.startsWith("sha256=")
    ? header.slice("sha256=".length)
    : header;

  return /^[a-f0-9]+$/i.test(value) ? value : null;
}

function mapMessageType(type: string | undefined): WhatsAppMessageType {
  switch (type) {
    case "text":
    case "button":
    case "interactive":
    case "image":
    case "audio":
    case "document":
      return type;
    default:
      return "unknown";
  }
}

function mapStatus(
  status: string | undefined
): WhatsAppStatusEvent["status"] {
  switch (status) {
    case "sent":
    case "delivered":
    case "read":
    case "failed":
      return status;
    default:
      return "unknown";
  }
}

function extractText(message: KapsoMessage): string | null {
  if (message.text?.body) return message.text.body;
  if (message.button?.payload) return message.button.payload;
  if (message.button?.text) return message.button.text;
  if (message.interactive?.button_reply?.id) {
    return message.interactive.button_reply.id;
  }
  if (message.interactive?.button_reply?.title) {
    return message.interactive.button_reply.title;
  }
  if (message.interactive?.list_reply?.id) {
    return message.interactive.list_reply.id;
  }
  if (message.interactive?.list_reply?.title) {
    return message.interactive.list_reply.title;
  }
  return null;
}

function extractErrors(
  message: KapsoMessage,
  latestStatus: KapsoRawStatus | null
): Array<Record<string, unknown>> {
  if (Array.isArray(message.errors)) return message.errors;
  if (isRecord(message.error)) return [message.error];
  if (Array.isArray(latestStatus?.errors)) return latestStatus.errors;
  return [];
}

function latestKapsoStatus(message: KapsoMessage): KapsoRawStatus | null {
  const statuses = message.kapso?.statuses;
  if (!Array.isArray(statuses)) return null;

  for (let index = statuses.length - 1; index >= 0; index -= 1) {
    const status = statuses[index];
    if (isRecord(status)) return status as KapsoRawStatus;
  }
  return null;
}

function timestampToIso(timestamp: string | number | undefined): string {
  if (timestamp === undefined || timestamp === null) return new Date().toISOString();

  if (typeof timestamp === "number") {
    const milliseconds = timestamp > 10_000_000_000 ? timestamp : timestamp * 1000;
    return new Date(milliseconds).toISOString();
  }

  const numericTimestamp = Number(timestamp);
  if (Number.isFinite(numericTimestamp)) {
    const milliseconds =
      numericTimestamp > 10_000_000_000
        ? numericTimestamp
        : numericTimestamp * 1000;
    return new Date(milliseconds).toISOString();
  }

  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
