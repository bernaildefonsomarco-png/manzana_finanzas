import type { SupabaseClient } from "@supabase/supabase-js";
import { recordInitialOnboardingValue } from "@/core/onboarding/onboarding-activation";
import type { Database } from "@/data/supabase/types";
import type { OutboxHandler } from "@/workers/outbox/outbox-publisher";

type Client = SupabaseClient<Database>;

export function createOnboardingActivationHandler(
  client: Client
): OutboxHandler {
  return {
    consumerName: "onboarding_activation.initial_v1",
    canHandle: (event) =>
      (event.aggregate_type === "movement" &&
        event.event_type === "movement_created") ||
      (event.aggregate_type === "pending_item" &&
        event.event_type === "pending_confirmed"),
    handle: async (event) => {
      await recordInitialOnboardingValue(client, {
        userId: event.user_id,
        trigger:
          event.event_type === "pending_confirmed"
            ? "pending_confirmed"
            : "movement_confirmed",
        source: "transactional_outbox",
        traceId: event.trace_id,
      });
    },
  };
}
