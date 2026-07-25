import type {
  OutboundWhatsAppCommand,
  WhatsAppProviderError,
  WhatsAppSendResult,
} from "./types";

export type MetaCloudSendConfig = {
  accessToken: string;
  phoneNumberId: string;
  graphVersion?: string;
  apiBaseUrl?: string;
};

export type MetaCloudMessagePayload = {
  messaging_product: "whatsapp";
  recipient_type: "individual";
  to: string;
  type: "text" | "template" | "interactive";
  text?: {
    preview_url: false;
    body: string;
  };
  template?: {
    name: string;
    language: {
      code: string;
    };
    components?: Array<{
      type: "body";
      parameters: Array<{
        type: "text";
        text: string;
      }>;
    }>;
  };
  interactive?: {
    type: "button";
    body: {
      text: string;
    };
    action: {
      buttons: Array<{
        type: "reply";
        reply: {
          id: string;
          title: string;
        };
      }>;
    };
  };
};

type MetaCloudSuccessResponse = {
  messages?: Array<{ id?: string }>;
  [key: string]: unknown;
};

type MetaCloudErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: string | number;
    error_subcode?: string | number;
  };
  [key: string]: unknown;
};

type Fetcher = typeof fetch;

export class WhatsAppSenderError extends Error {
  constructor(readonly providerError: WhatsAppProviderError) {
    super(providerError.message);
    this.name = "WhatsAppSenderError";
  }
}

export function buildMetaCloudMessagePayload(
  command: OutboundWhatsAppCommand
): MetaCloudMessagePayload {
  const base = {
    messaging_product: "whatsapp" as const,
    recipient_type: "individual" as const,
    to: toMetaRecipientPhone(command.toPhone),
  };

  if (command.provider !== "meta_cloud") {
    throw invalidMessage("Solo Meta Cloud esta soportado en WhatsApp V1.");
  }

  if (command.messageKind === "freeform") {
    if (!command.text?.trim()) {
      throw invalidMessage("El mensaje freeform requiere texto.");
    }

    return {
      ...base,
      type: "text",
      text: {
        preview_url: false,
        body: command.text,
      },
    };
  }

  if (command.messageKind === "template") {
    if (!command.templateName?.trim()) {
      throw invalidMessage("El mensaje template requiere templateName.");
    }

    const parameters = Object.keys(command.templateParams ?? {})
      .sort()
      .map((key) => ({
        type: "text" as const,
        text: command.templateParams?.[key] ?? "",
      }));

    return {
      ...base,
      type: "template",
      template: {
        name: command.templateName,
        language: {
          code: command.templateLanguage ?? "es_PE",
        },
        ...(parameters.length > 0
          ? {
              components: [
                {
                  type: "body" as const,
                  parameters,
                },
              ],
            }
          : {}),
      },
    };
  }

  if (command.messageKind === "interactive") {
    const interactive = command.interactive;
    if (!interactive || interactive.type !== "button") {
      throw invalidMessage("El mensaje interactive requiere botones.");
    }
    if (!interactive.bodyText.trim()) {
      throw invalidMessage("El mensaje interactive requiere bodyText.");
    }
    if (interactive.buttons.length < 1 || interactive.buttons.length > 3) {
      throw invalidMessage("WhatsApp permite entre 1 y 3 botones por mensaje.");
    }

    return {
      ...base,
      type: "interactive",
      interactive: {
        type: "button",
        body: {
          text: interactive.bodyText,
        },
        action: {
          buttons: interactive.buttons.map((button) => {
            if (!button.id.trim() || !button.title.trim()) {
              throw invalidMessage("Cada boton requiere id y title.");
            }

            return {
              type: "reply" as const,
              reply: {
                id: button.id,
                title: button.title,
              },
            };
          }),
        },
      },
    };
  }

  throw invalidMessage("Tipo de mensaje WhatsApp no soportado.");
}

export async function sendMetaCloudMessage(
  command: OutboundWhatsAppCommand,
  config: MetaCloudSendConfig,
  fetcher: Fetcher = fetch
): Promise<WhatsAppSendResult> {
  validateConfig(config);

  const payload = buildMetaCloudMessagePayload(command);
  const endpoint = buildMessagesEndpoint(config);
  const response = await fetcher(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw new WhatsAppSenderError(
      mapMetaCloudProviderError(body, response.status)
    );
  }

  const providerMessageId = extractProviderMessageId(body);
  if (!providerMessageId) {
    throw new WhatsAppSenderError({
      code: "PROVIDER_RESPONSE_INVALID",
      message: "Meta acepto la llamada sin devolver id de mensaje.",
      httpStatus: response.status,
      raw: body,
    });
  }

  return {
    provider: "meta_cloud",
    providerMessageId,
    toPhone: command.toPhone,
    httpStatus: response.status,
    raw: body,
  };
}

export function getMetaCloudSendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): MetaCloudSendConfig {
  return {
    accessToken: env.WHATSAPP_TOKEN ?? "",
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID ?? "",
    graphVersion: env.WHATSAPP_GRAPH_VERSION,
  };
}

export function mapMetaCloudProviderError(
  body: unknown,
  httpStatus: number
): WhatsAppProviderError {
  const errorBody = isRecord(body) ? (body as MetaCloudErrorBody) : {};
  const providerError = errorBody.error;

  return {
    code: "PROVIDER_ERROR",
    message:
      providerError?.message ??
      `Meta Cloud WhatsApp respondio con HTTP ${httpStatus}.`,
    httpStatus,
    providerErrorCode: providerError?.error_subcode ?? providerError?.code ?? null,
    providerErrorType: providerError?.type ?? null,
    raw: body,
  };
}

export function toMetaRecipientPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 32) {
    throw invalidMessage("Telefono WhatsApp invalido para envio.");
  }

  return digits;
}

function buildMessagesEndpoint(config: MetaCloudSendConfig): string {
  const baseUrl = config.apiBaseUrl ?? "https://graph.facebook.com";
  const graphVersion = config.graphVersion ?? "v25.0";
  return `${baseUrl.replace(/\/$/, "")}/${graphVersion}/${config.phoneNumberId}/messages`;
}

function validateConfig(config: MetaCloudSendConfig): void {
  if (!config.accessToken) {
    throw new WhatsAppSenderError({
      code: "CONFIG_MISSING",
      message: "Falta WHATSAPP_TOKEN para enviar por Meta Cloud.",
    });
  }
  if (!config.phoneNumberId) {
    throw new WhatsAppSenderError({
      code: "CONFIG_MISSING",
      message: "Falta WHATSAPP_PHONE_NUMBER_ID para enviar por Meta Cloud.",
    });
  }
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { raw_text: text };
  }
}

function extractProviderMessageId(body: unknown): string | null {
  if (!isRecord(body)) return null;

  const successBody = body as MetaCloudSuccessResponse;
  const id = successBody.messages?.[0]?.id;
  return typeof id === "string" && id.trim() ? id : null;
}

function invalidMessage(message: string): WhatsAppSenderError {
  return new WhatsAppSenderError({
    code: "INVALID_MESSAGE",
    message,
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
