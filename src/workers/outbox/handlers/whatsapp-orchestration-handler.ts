import type { SupabaseClient } from "@supabase/supabase-js";
import { FinancialOrchestrator } from "@/core/orchestrator/financial-orchestrator";
import { getExternalEventById } from "@/data/repositories/events.repository";
import type { TurnInput } from "@/core/channel/types";
import type { Database } from "@/data/supabase/types";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";
import { buildWhatsAppPresentTurn } from "@/adapters/whatsapp/present-turn";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export function createWhatsAppOrchestrationHandler(
  client: Client
): OutboxHandler {
  return {
    consumerName: "financial_orchestrator.whatsapp_inbound",
    canHandle: (event) =>
      event.event_type === "whatsapp.message_received" &&
      event.aggregate_type === "external_event",
    handle: async (event) => {
      const externalEvent = await getExternalEventById(
        client,
        event.aggregate_id,
      );
      if (!externalEvent) {
        logger.warn("whatsapp_orchestration_handler.external_event_missing", {
          outbox_id: event.id,
          external_event_id: event.aggregate_id,
        });
        return;
      }

      const messageType = readString(externalEvent.metadata.message_type);
      const text = readString(externalEvent.metadata.text);
      const turnInput: TurnInput = {
        actor: "user",
        text: isActionableWhatsAppMessageType(messageType) ? text : null,
        choice: null,
        confirmation: null,
        attachments: [],
        context: { where: null, filters: null, selected: null, visible: [] },
        channel: "whatsapp",
      };

      const presentTurn = await buildWhatsAppPresentTurn({
        client,
        externalEvent,
        sendEnabled: shouldSendWhatsAppResponses(),
        useResponseAgent: true,
      });

      const orchestrator = new FinancialOrchestrator(client, {
        executeReadyDataActions: shouldExecuteReadyDataActions(),
        presentTurn,
      });

      await orchestrator.handleTurn({
        externalEventId: externalEvent.id,
        turnInput,
        traceId: event.trace_id,
      });
    },
  };
}

function isActionableWhatsAppMessageType(messageType: string | null): boolean {
  return (
    messageType === "text" ||
    messageType === "button" ||
    messageType === "interactive"
  );
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function shouldExecuteReadyDataActions(): boolean {
  if (process.env.WHATSAPP_EXECUTE_READY_ACTIONS === "true") return true;
  return process.env.APP_ENV === "local";
}

function shouldSendWhatsAppResponses(): boolean {
  return process.env.WHATSAPP_SEND_RESPONSES === "true";
}
