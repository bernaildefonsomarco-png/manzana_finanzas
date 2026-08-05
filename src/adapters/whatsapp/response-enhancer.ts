import type { ResponseAgent } from "@/agents/response-agent";
import type {
  ConversationStyleProfile,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type { ConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import type { ExternalEventLog } from "@/core/events/domain-events";
import {
  enhanceResponseText,
  notApplicableEnhancementTrace,
  type ResponseAgentEnhancementTrace,
} from "@/core/response/response-agent-enhancement";
import type { WhatsAppShapedResponse } from "./response-shaper";

export type { ResponseAgentEnhancementTrace } from "@/core/response/response-agent-enhancement";

export async function maybeEnhanceResponseWithAgent(params: {
  shaped: WhatsAppShapedResponse;
  reason: string;
  externalEvent: ExternalEventLog;
  responseAgent: ResponseAgent;
  traceId: string;
  timezone?: string;
  discreetMode?: boolean;
  conversationTurnState: ConversationTurnState;
  activeConversationState?: ConversationMemoryState | null;
  preferredTone?: string | null;
  conversationStyle?: ConversationStyleProfile | null;
}): Promise<{
  shaped: WhatsAppShapedResponse;
  trace: ResponseAgentEnhancementTrace;
}> {
  if (!isSendableShape(params.shaped)) {
    return {
      shaped: params.shaped,
      trace: notApplicableEnhancementTrace("not_sendable"),
    };
  }

  const { text, trace } = await enhanceResponseText({
    baseText: params.shaped.text,
    channel: "whatsapp",
    reason: params.reason,
    externalEvent: params.externalEvent,
    responseAgent: params.responseAgent,
    traceId: params.traceId,
    timezone: params.timezone,
    discreetMode: params.discreetMode,
    conversationTurnState: params.conversationTurnState,
    activeConversationState: params.activeConversationState,
    preferredTone: params.preferredTone,
    conversationStyle: params.conversationStyle,
  });

  if (trace.status !== "completed") {
    return { shaped: params.shaped, trace };
  }

  return { shaped: replaceShapedText(params.shaped, text), trace };
}

function isSendableShape(
  shaped: WhatsAppShapedResponse
): shaped is Extract<WhatsAppShapedResponse, { kind: "freeform" | "interactive" }> {
  return shaped.kind === "freeform" || shaped.kind === "interactive";
}

function replaceShapedText(
  shaped: Extract<WhatsAppShapedResponse, { kind: "freeform" | "interactive" }>,
  text: string
): WhatsAppShapedResponse {
  if (shaped.kind === "interactive") {
    return {
      ...shaped,
      text,
      interactive: {
        ...shaped.interactive,
        bodyText: text,
      },
    };
  }

  return {
    ...shaped,
    text,
  };
}
