import { createHmac, timingSafeEqual } from "node:crypto";
import type {
  InboundWhatsAppEvent,
  NormalizedWhatsAppWebhook,
  WhatsAppMessageType,
  WhatsAppStatusEvent,
} from "./types";
import { normalizePhone } from "./meta-cloud-adapter";

type YCloudWebhookPayload = {
  id?: string;
  type?: string;
  createTime?: string;
  whatsappInboundMessage?: YCloudInboundMessage;
  whatsappMessage?: YCloudOutboundMessage;
  [key: string]: unknown;
};

type YCloudInboundMessage = {
  id?: string;
  wamid?: string;
  wabaId?: string;
  from?: string;
  to?: string;
  sendTime?: string;
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
  [key: string]: unknown;
};

type YCloudOutboundMessage = {
  id?: string;
  wamid?: string;
  wabaId?: string;
  to?: string;
  sendTime?: string;
  deliverTime?: string;
  readTime?: string;
  status?: string;
  conversation?: { id?: string; originType?: string };
  pricingCategory?: string;
  externalId?: string;
  errorCode?: string | number;
  errorMessage?: string;
  whatsappApiError?: unknown;
  [key: string]: unknown;
};

export function verifyYCloudWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string | undefined,
  options: { requireSignature: boolean }
): boolean {
  if (!options.requireSignature && !webhookSecret) return true;
  if (!webhookSecret || !signatureHeader) return false;

  const signature = parseYCloudSignature(signatureHeader);
  if (!signature) return false;

  const expected = createHmac("sha256", webhookSecret)
    .update(`${signature.timestamp}.${rawBody}`, "utf8")
    .digest("hex");

  const expectedBuffer = Buffer.from(expected, "hex");
  const receivedBuffer = Buffer.from(signature.value, "hex");

  if (expectedBuffer.length !== receivedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function normalizeYCloudWebhook(
  payload: unknown
): NormalizedWhatsAppWebhook {
  if (!isRecord(payload)) return { inboundMessages: [], statuses: [] };

  const body = payload as YCloudWebhookPayload;
  const inboundMessages: InboundWhatsAppEvent[] = [];
  const statuses: WhatsAppStatusEvent[] = [];

  if (body.type === "whatsapp.inbound_message.received") {
    const message = body.whatsappInboundMessage;
    const providerMessageId = readString(message?.id) ?? readString(message?.wamid);

    if (message && providerMessageId && message.from) {
      inboundMessages.push({
        provider: "ycloud",
        providerMessageId,
        providerThreadId: body.id ?? message.wabaId ?? null,
        waPhoneNumberId: message.wabaId ?? "",
        fromPhone: normalizePhone(message.from),
        toPhone: normalizePhone(message.to ?? ""),
        receivedAt: validIsoOrNow(message.sendTime ?? body.createTime),
        messageType: mapMessageType(message.type),
        text: extractText(message),
        payload: {
          event_id: body.id ?? null,
          event_type: body.type,
          message,
        },
      });
    }
  }

  if (body.type === "whatsapp.message.updated") {
    const message = body.whatsappMessage;
    const providerMessageId = readString(message?.id) ?? readString(message?.wamid);

    if (message && providerMessageId) {
      statuses.push({
        provider: "ycloud",
        providerMessageId,
        waPhoneNumberId: message.wabaId ?? "",
        recipientPhone: normalizePhone(message.to ?? ""),
        status: mapStatus(message.status),
        receivedAt: statusTimestamp(message, body.createTime),
        conversationId: message.conversation?.id ?? null,
        pricingCategory:
          message.pricingCategory ?? message.conversation?.originType ?? null,
        errors: extractErrors(message),
        payload: {
          event_id: body.id ?? null,
          event_type: body.type,
          message,
        },
      });
    }
  }

  return { inboundMessages, statuses };
}

function parseYCloudSignature(
  header: string
): { timestamp: string; value: string } | null {
  const parts = new Map(
    header.split(",").map((part) => {
      const [key, ...value] = part.trim().split("=");
      return [key, value.join("=")] as const;
    })
  );
  const timestamp = parts.get("t");
  const value = parts.get("s");

  if (!timestamp || !value || !/^[a-f0-9]+$/i.test(value)) return null;
  return { timestamp, value };
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

function extractText(message: YCloudInboundMessage): string | null {
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

function statusTimestamp(
  message: YCloudOutboundMessage,
  fallback: string | undefined
): string {
  if (message.status === "read") return validIsoOrNow(message.readTime ?? fallback);
  if (message.status === "delivered") {
    return validIsoOrNow(message.deliverTime ?? fallback);
  }
  if (message.status === "sent") return validIsoOrNow(message.sendTime ?? fallback);
  return validIsoOrNow(fallback ?? message.readTime ?? message.deliverTime);
}

function validIsoOrNow(value: string | undefined): string {
  if (!value) return new Date().toISOString();

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date().toISOString();
  return parsed.toISOString();
}

function extractErrors(
  message: YCloudOutboundMessage
): Array<Record<string, unknown>> {
  const error: Record<string, unknown> = {};

  if (message.errorCode !== undefined) error.code = message.errorCode;
  if (message.errorMessage) error.message = message.errorMessage;
  if (message.whatsappApiError !== undefined) {
    error.whatsappApiError = message.whatsappApiError;
  }

  return Object.keys(error).length > 0 ? [error] : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
