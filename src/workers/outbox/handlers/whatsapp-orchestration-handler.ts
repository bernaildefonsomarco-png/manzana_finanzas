import type { SupabaseClient } from "@supabase/supabase-js";
import { FinancialOrchestrator } from "@/core/orchestrator/financial-orchestrator";
import type { Database } from "@/data/supabase/types";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

export function createWhatsAppOrchestrationHandler(
  client: Client
): OutboxHandler {
  const orchestrator = new FinancialOrchestrator(client, {
    executeReadyDataActions: shouldExecuteReadyDataActions(),
    sendWhatsAppResponses: shouldSendWhatsAppResponses(),
  });

  return {
    consumerName: "financial_orchestrator.whatsapp_inbound",
    canHandle: (event) =>
      event.event_type === "whatsapp.message_received" &&
      event.aggregate_type === "external_event",
    handle: async (event) => {
      await orchestrator.handleWhatsAppInboundEvent(event);
    },
  };
}

function shouldExecuteReadyDataActions(): boolean {
  if (process.env.WHATSAPP_EXECUTE_READY_ACTIONS === "true") return true;
  return process.env.APP_ENV === "local";
}

function shouldSendWhatsAppResponses(): boolean {
  return process.env.WHATSAPP_SEND_RESPONSES === "true";
}
