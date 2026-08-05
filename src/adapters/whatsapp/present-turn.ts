import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { ExternalEventLog } from "@/core/events/domain-events";
import type { PresentedTurn } from "@/core/channel/types";
import type { PresentTurn, PresentTurnContext } from "@/core/orchestrator/financial-orchestrator";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import { ResponseAgent } from "@/agents/response-agent";
import { getActiveConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import { readPersistentConversationStyle } from "@/core/conversation/conversation-style-preferences";
import { formatConversationStyleInstruction } from "@/core/response/conversation-style-policy";
import {
  getWhatsAppWindowByUserAndPhone,
  type WhatsAppWindowState,
} from "@/data/repositories/whatsapp-window.repository";
import { shapeBlocksForWhatsApp, type WhatsAppShapedResponse } from "./response-shaper";
import { sendShapedWhatsAppResponse } from "./response-sender";
import { maybeEnhanceResponseWithAgent } from "./response-enhancer";

type Client = SupabaseClient<Database>;

/**
 * Construye el `presentTurn` inyectado en `FinancialOrchestrator` (21 S6):
 * el nucleo nunca importa nada de aqui, solo llama la funcion que este
 * adaptador le entrega.
 */
export async function buildWhatsAppPresentTurn(params: {
  client: Client;
  externalEvent: ExternalEventLog;
  responseAgent?: ResponseAgent;
  sendEnabled: boolean;
  useResponseAgent: boolean;
}): Promise<PresentTurn> {
  const client = params.client;
  const externalEvent = params.externalEvent;
  const responseAgent = params.responseAgent ?? new ResponseAgent();
  const fromPhone = readString(externalEvent.metadata.from_phone);
  const windowState: WhatsAppWindowState | null =
    fromPhone && externalEvent.user_id
      ? await getWhatsAppWindowByUserAndPhone(client, externalEvent.user_id, fromPhone)
      : null;

  return async (plan: PlanTurnBlocksResult, context: PresentTurnContext): Promise<PresentedTurn> => {
    const shaped = shapeBlocksForWhatsApp({
      blocks: plan.blocks,
      intent: plan.intent,
      windowState,
    });

    if (context.skipEnhancement || !params.useResponseAgent) {
      return finish(shaped, notApplicableEnhancement("disabled"));
    }

    const [activeConversationState, preferencesResult] = await Promise.all([
      getActiveConversationMemoryState(client, {
        userId: externalEvent.user_id!,
        channel: "whatsapp",
        now: externalEvent.received_at,
      }),
      client
        .from("user_preferences")
        .select("tone_style,discreet_mode_enabled,metadata")
        .eq("user_id", externalEvent.user_id!)
        .maybeSingle(),
    ]);

    const persistentStyle =
      preferencesResult.error === null
        ? readPersistentConversationStyle({
            metadata: preferencesResult.data?.metadata,
            legacyToneStyle: preferencesResult.data?.tone_style,
          })
        : null;
    const effectiveStyle =
      context.styleOverride ??
      activeConversationState?.working_set?.conversation_style ??
      persistentStyle ??
      null;

    const enhanced = await maybeEnhanceResponseWithAgent({
      shaped,
      reason: plan.reason,
      externalEvent,
      responseAgent,
      traceId: context.traceId,
      timezone: context.timezone,
      discreetMode:
        preferencesResult.error === null &&
        preferencesResult.data?.discreet_mode_enabled === true,
      preferredTone:
        formatConversationStyleInstruction(effectiveStyle) ??
        (preferencesResult.error === null
          ? (preferencesResult.data?.tone_style ?? null)
          : null),
      conversationStyle: effectiveStyle,
      conversationTurnState: context.conversationTurnState,
      activeConversationState,
    });

    return finish(enhanced.shaped, {
      status: enhanced.trace.status,
      reason: enhanced.trace.reason,
      confidence: enhanced.trace.confidence,
      provider: enhanced.trace.provider,
      model: enhanced.trace.model_name,
      latencyMs: enhanced.trace.latency_ms,
      safetyFlags: enhanced.trace.safety_flags,
      styleActive: enhanced.trace.style_active ?? false,
      styleScope: enhanced.trace.style_scope ?? null,
      styleAdherence: enhanced.trace.style_adherence ?? null,
      styleBlockedReasons: enhanced.trace.style_blocked_reasons ?? [],
      attemptCount: enhanced.trace.attempt_count ?? 0,
    });

    async function finish(
      shapedResponse: WhatsAppShapedResponse,
      enhancement: PresentedTurn["enhancement"]
    ): Promise<PresentedTurn> {
      const sendResult = await sendShapedWhatsAppResponse({
        client,
        externalEvent,
        shaped: shapedResponse,
        responseReason: plan.reason,
        sendEnabled: params.sendEnabled,
      });

      return {
        text: shapedResponse.kind === "not_sendable" ? null : shapedResponse.text,
        deliveryMode:
          shapedResponse.kind === "not_sendable" ? null : shapedResponse.deliveryPlan.mode,
        interactiveOptionCount:
          shapedResponse.kind === "interactive" ? shapedResponse.interactive.buttons.length : null,
        sendStatus: sendResult.kind,
        sendReason: sendResult.reason,
        idempotent: sendResult.idempotent,
        providerMessageId: sendResult.provider_message_id,
        errorCode: sendResult.kind === "failed" ? sendResult.error_code : null,
        enhancement,
      };
    }
  };
}

function notApplicableEnhancement(reason: "disabled"): PresentedTurn["enhancement"] {
  return {
    status: "not_applicable",
    reason,
    confidence: null,
    provider: null,
    model: null,
    latencyMs: null,
    safetyFlags: [],
    styleActive: false,
    styleScope: null,
    styleAdherence: null,
    styleBlockedReasons: [],
    attemptCount: 0,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
