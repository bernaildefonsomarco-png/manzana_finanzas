import type { SupabaseClient } from "@supabase/supabase-js";
import { WhatsAppSenderError } from "@/adapters/whatsapp/meta-cloud-sender";
import { sendTrackedWhatsAppMessage } from "@/adapters/whatsapp/outbound-service";
import {
  getWhatsAppProviderFromEnv,
  getWhatsAppSendConfigFromEnv,
  isWhatsAppSendConfigReady,
} from "@/adapters/whatsapp/send-config";
import type { Database } from "@/data/supabase/types";
import type { ExternalEventLog } from "@/core/events/domain-events";
import type { WhatsAppShapedResponse } from "./response-shaper";

type Client = SupabaseClient<Database>;

export type WhatsAppResponseSendResult =
  | {
      kind: "not_sent";
      reason:
        | "response_not_sendable"
        | "send_disabled"
        | "missing_recipient"
        | "config_missing";
      idempotent: false;
      provider_message_id: null;
    }
  | {
      kind: "sent";
      reason: "sent_to_whatsapp_provider";
      idempotent: boolean;
      provider_message_id: string | null;
    }
  | {
      kind: "failed";
      reason: "provider_error" | "unexpected_error";
      idempotent: false;
      provider_message_id: null;
      error_code: string;
      error_message: string;
    };

export async function sendShapedWhatsAppResponse(params: {
  client: Client;
  externalEvent: ExternalEventLog;
  shaped: WhatsAppShapedResponse;
  responseReason: string;
  sendEnabled: boolean;
}): Promise<WhatsAppResponseSendResult> {
  if (params.shaped.kind !== "freeform" && params.shaped.kind !== "interactive") {
    return notSent("response_not_sendable");
  }

  if (!params.sendEnabled) {
    return notSent("send_disabled");
  }

  const toPhone = readString(params.externalEvent.metadata.from_phone);
  if (!toPhone) return notSent("missing_recipient");

  const provider = getWhatsAppProviderFromEnv();
  const config = getWhatsAppSendConfigFromEnv();
  if (!isWhatsAppSendConfigReady(config)) {
    return notSent("config_missing");
  }

  try {
    const result = await sendTrackedWhatsAppMessage(
      params.client,
      {
        provider,
        userId: params.externalEvent.user_id!,
        toPhone,
        messageKind: params.shaped.kind === "interactive" ? "interactive" : "freeform",
        text: params.shaped.kind === "freeform" ? params.shaped.text : undefined,
        interactive: params.shaped.kind === "interactive" ? params.shaped.interactive : undefined,
        idempotencyKey: buildWhatsAppResponseIdempotencyKey({
          externalEventId: params.externalEvent.id,
          responseReason: params.responseReason,
        }),
        traceId: params.externalEvent.trace_id,
        metadata: {
          external_event_id: params.externalEvent.id,
          response_reason: params.responseReason,
          response_plan_kind: params.shaped.kind,
          delivery_plan_reason: params.shaped.deliveryPlan.reason,
        },
      },
      config
    );

    return {
      kind: "sent",
      reason: "sent_to_whatsapp_provider",
      idempotent: result.idempotent,
      provider_message_id:
        result.providerResult?.providerMessageId ?? result.attempt.provider_message_id,
    };
  } catch (error) {
    if (error instanceof WhatsAppSenderError) {
      return {
        kind: "failed",
        reason: "provider_error",
        idempotent: false,
        provider_message_id: null,
        error_code: error.providerError.code,
        error_message: error.providerError.message,
      };
    }

    return {
      kind: "failed",
      reason: "unexpected_error",
      idempotent: false,
      provider_message_id: null,
      error_code: "UNEXPECTED_ERROR",
      error_message: error instanceof Error ? error.message : "Error inesperado",
    };
  }
}

export function buildWhatsAppResponseIdempotencyKey(params: {
  externalEventId: string;
  responseReason: string;
}): string {
  return `whatsapp-response:${params.externalEventId}:${params.responseReason}`;
}

function notSent(
  reason: Extract<WhatsAppResponseSendResult, { kind: "not_sent" }>["reason"]
): WhatsAppResponseSendResult {
  return {
    kind: "not_sent",
    reason,
    idempotent: false,
    provider_message_id: null,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
