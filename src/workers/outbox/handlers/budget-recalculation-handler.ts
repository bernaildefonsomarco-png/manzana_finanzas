import type { SupabaseClient } from "@supabase/supabase-js";
import { runBudgetDailyLifecycle } from "@/data/repositories/budgets.repository";
import type { Database } from "@/data/supabase/types";
import { isoDateInLima } from "@/shared/dates/lima";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

export function createBudgetRecalculationHandler(
  client: Client
): OutboxHandler {
  return {
    consumerName: "budget_engine.recalculation_v1",
    canHandle: (event) =>
      event.event_type === "budget_recalculation_requested",
    handle: async (event) => {
      const payloadDate =
        typeof event.payload.as_of === "string"
          ? event.payload.as_of
          : null;
      await runBudgetDailyLifecycle(client, {
        userId: event.user_id,
        asOf:
          payloadDate ??
          isoDateInLima(new Date(event.created_at)),
      });
    },
  };
}
