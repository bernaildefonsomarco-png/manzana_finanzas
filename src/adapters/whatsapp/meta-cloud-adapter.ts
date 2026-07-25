import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  InboundWhatsAppEvent,
  NormalizedWhatsAppWebhook,
  WhatsAppMessageType,
  WhatsAppStatusEvent,
} from "./types";

type MetaWebhookPayload = {
  object?: string;
  entry?: MetaEntry[];
};

type MetaEntry = {
  id?: string;
  changes?: MetaChange[];
};

type MetaChange = {
  field?: string;
  value?: {
    metadata?: {
      display_phone_number?: string;
      phone_number_id?: string;
    };
    contacts?: Array<Record<string, unknown>>;
    messages?: MetaMessage[];
    statuses?: MetaStatus[];
  };
};

type MetaMessage = {
  id?: string;
  from?: string;
  timestamp?: string;
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
};

type MetaStatus = {
  id?: string;
  recipient_id?: string;
  status?: string;
  timestamp?: string;
  conversation?: { id?: string };
  pricing?: { category?: string };
  errors?: Array<Record<string, unknown>>;
};

export function verifyMetaWebhookChallenge(
  searchParams: URLSearchParams,
  verifyToken: string | undefined
): string | null {
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (!verifyToken || mode !== "subscribe" || token !== verifyToken || !challenge) {
    return null;
  }

  return challenge;
}

export function verifyMetaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string | undefined,
  options: { requireSignature: boolean }
): boolean {
  if (!options.requireSignature && !appSecret) return true;
  if (!appSecret || !signatureHeader?.startsWith("sha256=")) return false;

  const expected = createHmac("sha256", appSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const received = signatureHeader.slice("sha256=".length);

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(received, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function normalizeMetaCloudWebhook(
  payload: unknown
): NormalizedWhatsAppWebhook {
  if (!isRecord(payload)) {
    return { inboundMessages: [], statuses: [] };
  }

  const body = payload as MetaWebhookPayload;
  const inboundMessages: InboundWhatsAppEvent[] = [];
  const statuses: WhatsAppStatusEvent[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneNumberId = value?.metadata?.phone_number_id ?? "";
      const displayPhoneNumber = normalizePhone(
        value?.metadata?.display_phone_number ?? phoneNumberId
      );
      const contactByWaId = buildContactIndex(value?.contacts ?? []);

      for (const message of value?.messages ?? []) {
        if (!message.id || !message.from) continue;

        inboundMessages.push({
          provider: "meta_cloud",
          providerMessageId: message.id,
          providerThreadId: entry.id ?? null,
          waPhoneNumberId: phoneNumberId,
          fromPhone: normalizePhone(message.from),
          toPhone: displayPhoneNumber,
          receivedAt: timestampToIso(message.timestamp),
          messageType: mapMessageType(message.type),
          text: extractText(message),
          payload: {
            entry_id: entry.id ?? null,
            change_field: change.field ?? null,
            contact: contactByWaId.get(message.from) ?? null,
            message,
          },
        });
      }

      for (const status of value?.statuses ?? []) {
        if (!status.id) continue;

        statuses.push({
          provider: "meta_cloud",
          providerMessageId: status.id,
          waPhoneNumberId: phoneNumberId,
          recipientPhone: normalizePhone(status.recipient_id ?? ""),
          status: mapStatus(status.status),
          receivedAt: timestampToIso(status.timestamp),
          conversationId: status.conversation?.id ?? null,
          pricingCategory: status.pricing?.category ?? null,
          errors: status.errors ?? [],
          payload: {
            entry_id: entry.id ?? null,
            change_field: change.field ?? null,
            status,
          },
        });
      }
    }
  }

  return { inboundMessages, statuses };
}

export function buildWhatsAppMessageIdempotencyKey(
  event: InboundWhatsAppEvent
): string {
  return `${event.provider}:message:${event.providerMessageId}`;
}

export function buildWhatsAppStatusIdempotencyKey(
  event: WhatsAppStatusEvent
): string {
  return `${event.provider}:status:${event.providerMessageId}:${event.status}:${event.receivedAt}`;
}

export function normalizePhone(phone: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;

  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return trimmed;
  return `+${digits}`;
}

function buildContactIndex(contacts: Array<Record<string, unknown>>) {
  const index = new Map<string, Record<string, unknown>>();

  for (const contact of contacts) {
    const waId = contact.wa_id;
    if (typeof waId === "string") index.set(waId, contact);
  }

  return index;
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

function extractText(message: MetaMessage): string | null {
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

function timestampToIso(timestamp: string | undefined): string {
  if (!timestamp) return new Date().toISOString();

  const seconds = Number(timestamp);
  if (!Number.isFinite(seconds)) return new Date().toISOString();
  return new Date(seconds * 1000).toISOString();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
