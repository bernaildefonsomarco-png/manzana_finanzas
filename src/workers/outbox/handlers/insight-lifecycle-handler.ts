import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateAdvancedInsights } from "@/data/repositories/insights.repository";
import type { Database } from "@/data/supabase/types";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

const insightRelevantMovementEvents = new Set([
  "movement_created",
  "movement_updated",
  "movement_corrected",
  "movement_deleted",
  "movement_reversed",
  "movement_restored",
]);

const insightRelevantDebtEvents = new Set([
  "debt_payment_registered",
  "debt_paid",
]);

const insightRelevantRecurringEvents = new Set([
  "recurring_payment_confirmed",
  "recurring_amount_changed",
]);

export function createInsightLifecycleHandler(client: Client): OutboxHandler {
  return {
    consumerName: "insight_engine.lifecycle_v1",
    canHandle: (event) =>
      (event.aggregate_type === "movement" &&
        insightRelevantMovementEvents.has(event.event_type)) ||
      (event.aggregate_type === "debt" &&
        insightRelevantDebtEvents.has(event.event_type)) ||
      (event.aggregate_type === "recurring_rule" &&
        insightRelevantRecurringEvents.has(event.event_type)),
    handle: async (event) => {
      await evaluateAdvancedInsights(client, event.user_id, {
        traceId: event.trace_id,
      });
    },
  };
}
