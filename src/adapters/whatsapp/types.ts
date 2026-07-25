export type WhatsAppProvider = "kapso" | "ycloud" | "meta_cloud";

export type WhatsAppMessageType =
  | "text"
  | "button"
  | "interactive"
  | "image"
  | "audio"
  | "document"
  | "unknown";

export type InboundWhatsAppEvent = {
  provider: WhatsAppProvider;
  providerMessageId: string;
  providerThreadId: string | null;
  waPhoneNumberId: string;
  fromPhone: string;
  toPhone: string;
  receivedAt: string;
  messageType: WhatsAppMessageType;
  text: string | null;
  payload: Record<string, unknown>;
};

export type WhatsAppStatusEvent = {
  provider: WhatsAppProvider;
  providerMessageId: string;
  waPhoneNumberId: string;
  recipientPhone: string;
  status: "sent" | "delivered" | "read" | "failed" | "unknown";
  receivedAt: string;
  conversationId: string | null;
  pricingCategory: string | null;
  errors: Array<Record<string, unknown>>;
  payload: Record<string, unknown>;
};

export type NormalizedWhatsAppWebhook = {
  inboundMessages: InboundWhatsAppEvent[];
  statuses: WhatsAppStatusEvent[];
};

export type WhatsAppInteractiveButton = {
  id: string;
  title: string;
};

export type WhatsAppInteractivePayload = {
  type: "button";
  bodyText: string;
  buttons: WhatsAppInteractiveButton[];
};

export type OutboundWhatsAppCommand = {
  provider: WhatsAppProvider;
  userId: string;
  toPhone: string;
  messageKind: "freeform" | "template" | "interactive";
  text?: string;
  templateName?: string;
  templateLanguage?: string;
  templateParams?: Record<string, string>;
  interactive?: WhatsAppInteractivePayload;
  idempotencyKey: string;
  traceId: string;
  metadata?: Record<string, unknown>;
};

export type WhatsAppProviderError = {
  code: string;
  message: string;
  httpStatus?: number;
  providerErrorCode?: string | number | null;
  providerErrorType?: string | null;
  raw?: unknown;
};

export type WhatsAppSendResult = {
  provider: WhatsAppProvider;
  providerMessageId: string;
  toPhone: string;
  httpStatus: number;
  raw: unknown;
};
