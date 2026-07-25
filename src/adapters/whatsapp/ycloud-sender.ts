import type {
  OutboundWhatsAppCommand,
  WhatsAppProviderError,
  WhatsAppSendResult,
} from "./types";
import { WhatsAppSenderError } from "./meta-cloud-sender";

export type YCloudSendConfig = {
  apiKey: string;
  fromPhone: string;
  apiBaseUrl?: string;
};

export type YCloudMessagePayload = {
  from: string;
  to: string;
  type: "text" | "template" | "interactive";
  text?: {
    body: string;
    preview_url: false;
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
  externalId: string;
};

type YCloudSuccessResponse = {
  id?: string;
  wamid?: string;
  [key: string]: unknown;
};

type YCloudErrorBody = {
  error?: {
    message?: string;
    code?: string | number;
    type?: string;
    whatsappApiError?: unknown;
  };
  message?: string;
  code?: string | number;
  [key: string]: unknown;
};

type Fetcher = typeof fetch;

export function buildYCloudMessagePayload(
  command: OutboundWhatsAppCommand,
  config: YCloudSendConfig
): YCloudMessagePayload {
  if (command.provider !== "ycloud") {
    throw invalidMessage("El sender YCloud solo acepta provider ycloud.");
  }

  const base = {
    from: toYCloudE164Phone(config.fromPhone),
    to: toYCloudE164Phone(command.toPhone),
    externalId: command.idempotencyKey,
  };

  if (command.messageKind === "freeform") {
    if (!command.text?.trim()) {
      throw invalidMessage("El mensaje freeform requiere texto.");
    }

    return {
      ...base,
      type: "text",
      text: {
        body: command.text,
        preview_url: false,
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

export async function sendYCloudMessage(
  command: OutboundWhatsAppCommand,
  config: YCloudSendConfig,
  fetcher: Fetcher = fetch
): Promise<WhatsAppSendResult> {
  validateConfig(config);

  const payload = buildYCloudMessagePayload(command, config);
  const response = await fetcher(buildSendDirectlyEndpoint(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": config.apiKey,
    },
    body: JSON.stringify(payload),
  });
  const body = await parseJsonResponse(response);

  if (!response.ok) {
    throw new WhatsAppSenderError(mapYCloudProviderError(body, response.status));
  }

  const providerMessageId = extractProviderMessageId(body);
  if (!providerMessageId) {
    throw new WhatsAppSenderError({
      code: "PROVIDER_RESPONSE_INVALID",
      message: "YCloud acepto la llamada sin devolver id de mensaje.",
      httpStatus: response.status,
      raw: body,
    });
  }

  return {
    provider: "ycloud",
    providerMessageId,
    toPhone: command.toPhone,
    httpStatus: response.status,
    raw: body,
  };
}

export function getYCloudSendConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env
): YCloudSendConfig {
  return {
    apiKey: env.YCLOUD_API_KEY ?? "",
    fromPhone: env.YCLOUD_WHATSAPP_FROM_PHONE ?? env.WHATSAPP_FROM_PHONE ?? "",
    apiBaseUrl: env.YCLOUD_API_BASE_URL,
  };
}

export function mapYCloudProviderError(
  body: unknown,
  httpStatus: number
): WhatsAppProviderError {
  const errorBody = isRecord(body) ? (body as YCloudErrorBody) : {};
  const providerError = isRecord(errorBody.error) ? errorBody.error : null;

  return {
    code: "PROVIDER_ERROR",
    message:
      readString(providerError?.message) ??
      readString(errorBody.message) ??
      `YCloud WhatsApp respondio con HTTP ${httpStatus}.`,
    httpStatus,
    providerErrorCode:
      readString(providerError?.code) ?? readString(errorBody.code) ?? null,
    providerErrorType: readString(providerError?.type),
    raw: body,
  };
}

export function toYCloudE164Phone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8 || digits.length > 32) {
    throw invalidMessage("Telefono WhatsApp invalido para envio.");
  }

  return `+${digits}`;
}

function buildSendDirectlyEndpoint(config: YCloudSendConfig): string {
  const baseUrl = config.apiBaseUrl ?? "https://api.ycloud.com/v2";
  return `${baseUrl.replace(/\/$/, "")}/whatsapp/messages/sendDirectly`;
}

function validateConfig(config: YCloudSendConfig): void {
  if (!config.apiKey) {
    throw new WhatsAppSenderError({
      code: "CONFIG_MISSING",
      message: "Falta YCLOUD_API_KEY para enviar por YCloud.",
    });
  }
  if (!config.fromPhone) {
    throw new WhatsAppSenderError({
      code: "CONFIG_MISSING",
      message: "Falta YCLOUD_WHATSAPP_FROM_PHONE para enviar por YCloud.",
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

  const successBody = body as YCloudSuccessResponse;
  const id = successBody.id;
  if (typeof id === "string" && id.trim()) return id;

  const wamid = successBody.wamid;
  return typeof wamid === "string" && wamid.trim() ? wamid : null;
}

function invalidMessage(message: string): WhatsAppSenderError {
  return new WhatsAppSenderError({
    code: "INVALID_MESSAGE",
    message,
  });
}

function readString(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
