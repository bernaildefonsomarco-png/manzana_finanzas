import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import {
  createWhatsAppDeliveryAttempt,
  getWhatsAppDeliveryAttemptByIdempotencyKey,
  markWhatsAppDeliveryAccepted,
  markWhatsAppDeliveryFailed,
  type WhatsAppDeliveryAttempt,
  WhatsAppDeliveryRepositoryError,
} from "@/data/repositories/whatsapp-delivery.repository";
import {
  sendMetaCloudMessage,
  type MetaCloudSendConfig,
  WhatsAppSenderError,
} from "./meta-cloud-sender";
import {
  sendKapsoMessage,
  type KapsoSendConfig,
} from "./kapso-sender";
import {
  sendYCloudMessage,
  type YCloudSendConfig,
} from "./ycloud-sender";
import type { OutboundWhatsAppCommand, WhatsAppSendResult } from "./types";

type Client = SupabaseClient<Database>;
type Fetcher = typeof fetch;

export type WhatsAppSendConfig =
  | {
      provider: "kapso";
      kapso: KapsoSendConfig;
    }
  | {
      provider: "ycloud";
      ycloud: YCloudSendConfig;
    }
  | {
      provider: "meta_cloud";
      metaCloud: MetaCloudSendConfig;
    };

export type TrackedWhatsAppSendResult = {
  attempt: WhatsAppDeliveryAttempt;
  providerResult: WhatsAppSendResult | null;
  sent: boolean;
  idempotent: boolean;
};

export async function sendTrackedWhatsAppMessage(
  client: Client,
  command: OutboundWhatsAppCommand,
  config: WhatsAppSendConfig,
  fetcher?: Fetcher
): Promise<TrackedWhatsAppSendResult> {
  const existing = await getWhatsAppDeliveryAttemptByIdempotencyKey(client, {
    userId: command.userId,
    idempotencyKey: command.idempotencyKey,
  });

  if (existing) {
    return {
      attempt: existing,
      providerResult: null,
      sent: false,
      idempotent: true,
    };
  }

  const createdAttempt = await createDeliveryAttemptHandlingRace(client, command);
  if (createdAttempt.idempotent) {
    return {
      attempt: createdAttempt.attempt,
      providerResult: null,
      sent: false,
      idempotent: true,
    };
  }

  const startedAt = Date.now();
  try {
    const providerResult = await sendProviderMessage(command, config, fetcher);
    const latencyMs = Date.now() - startedAt;
    const attempt = await markWhatsAppDeliveryAccepted(client, {
      userId: command.userId,
      idempotencyKey: command.idempotencyKey,
      providerMessageId: providerResult.providerMessageId,
      httpStatus: providerResult.httpStatus,
      latencyMs,
      responseSummary: {
        provider: providerResult.provider,
        provider_message_id: providerResult.providerMessageId,
      },
    });

    return {
      attempt,
      providerResult,
      sent: true,
      idempotent: false,
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    if (error instanceof WhatsAppSenderError) {
      await markWhatsAppDeliveryFailed(client, {
        userId: command.userId,
        idempotencyKey: command.idempotencyKey,
        httpStatus: error.providerError.httpStatus ?? null,
        latencyMs,
        errorCode: error.providerError.code,
        errorMessage: error.providerError.message,
        responseSummary: {
          provider_error_code: error.providerError.providerErrorCode ?? null,
          provider_error_type: error.providerError.providerErrorType ?? null,
        },
      });
    } else {
      await markWhatsAppDeliveryFailed(client, {
        userId: command.userId,
        idempotencyKey: command.idempotencyKey,
        latencyMs,
        errorCode: "UNEXPECTED_ERROR",
        errorMessage: error instanceof Error ? error.message : "Error inesperado",
      });
    }

    throw error;
  }
}

async function createDeliveryAttemptHandlingRace(
  client: Client,
  command: OutboundWhatsAppCommand
): Promise<{ attempt: WhatsAppDeliveryAttempt; idempotent: boolean }> {
  try {
    const attempt = await createWhatsAppDeliveryAttempt(client, {
      userId: command.userId,
      provider: command.provider,
      messageKind: command.messageKind,
      toPhone: command.toPhone,
      templateName: command.templateName ?? null,
      idempotencyKey: command.idempotencyKey,
      traceId: command.traceId,
      requestSummary: buildSafeRequestSummary(command),
      metadata: command.metadata,
    });

    return { attempt, idempotent: false };
  } catch (error) {
    if (
      error instanceof WhatsAppDeliveryRepositoryError &&
      error.code === "WHATSAPP_DELIVERY_DUPLICATE"
    ) {
      const existing = await getWhatsAppDeliveryAttemptByIdempotencyKey(client, {
        userId: command.userId,
        idempotencyKey: command.idempotencyKey,
      });
      if (existing) return { attempt: existing, idempotent: true };
    }

    throw error;
  }
}

function sendProviderMessage(
  command: OutboundWhatsAppCommand,
  config: WhatsAppSendConfig,
  fetcher?: Fetcher
): Promise<WhatsAppSendResult> {
  if (command.provider !== config.provider) {
    throw new WhatsAppSenderError({
      code: "PROVIDER_CONFIG_MISMATCH",
      message: "El proveedor WhatsApp del comando no coincide con la config.",
    });
  }

  if (config.provider === "ycloud") {
    return sendYCloudMessage(command, config.ycloud, fetcher);
  }

  if (config.provider === "kapso") {
    return sendKapsoMessage(command, config.kapso, fetcher);
  }

  return sendMetaCloudMessage(command, config.metaCloud, fetcher);
}

function buildSafeRequestSummary(
  command: OutboundWhatsAppCommand
): Record<string, unknown> {
  return {
    provider: command.provider,
    message_kind: command.messageKind,
    has_text: Boolean(command.text),
    text_length: command.text?.length ?? 0,
    template_name: command.templateName ?? null,
    template_param_count: Object.keys(command.templateParams ?? {}).length,
    interactive_button_count: command.interactive?.buttons.length ?? 0,
  };
}
