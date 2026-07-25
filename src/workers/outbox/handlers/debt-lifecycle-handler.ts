import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshDebtLifecycle } from "@/core/debts/debt-lifecycle-service";
import type { Database } from "@/data/supabase/types";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

export function createDebtLifecycleHandler(client: Client): OutboxHandler {
  return {
    consumerName: "debt_engine.lifecycle_v1",
    canHandle: (event) =>
      event.event_type === "debt_payment_registered" &&
      event.aggregate_type === "debt",
    handle: async (event) => {
      await refreshDebtLifecycle(client, event.user_id, {
        traceId: event.trace_id,
      });
    },
  };
}
