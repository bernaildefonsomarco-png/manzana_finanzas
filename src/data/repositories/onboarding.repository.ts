import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import {
  ONBOARDING_STATUSES,
  type OnboardingStatus,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

const OnboardingTransitionSchema = z.object({
  changed: z.boolean(),
  previous_status: z.enum(ONBOARDING_STATUSES),
  current_status: z.enum(ONBOARDING_STATUSES),
  reason: z.enum(["advanced", "paused", "already_at_or_beyond_target"]),
  changed_at: z.string().datetime({ offset: true }).optional(),
});

export type OnboardingTransition = z.infer<
  typeof OnboardingTransitionSchema
>;

export type InitialOnboardingFacts = {
  confirmedMovementsCount: number;
  debtsCount: number;
};

export async function getInitialOnboardingFacts(
  client: Client,
  userId: string
): Promise<InitialOnboardingFacts> {
  const [movementResult, debtResult] = await Promise.all([
    client
      .from("movements")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "confirmed")
      .is("deleted_at", null),
    client
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("deleted_at", null),
  ]);

  if (movementResult.error || debtResult.error) {
    logger.error("onboarding.facts_failed", {
      movement_error: movementResult.error,
      debt_error: debtResult.error,
      user_id: userId,
    });
    throw movementResult.error ?? debtResult.error;
  }

  return {
    confirmedMovementsCount: movementResult.count ?? 0,
    debtsCount: debtResult.count ?? 0,
  };
}

export async function advanceOnboardingStage(
  client: Client,
  params: {
    userId: string;
    targetStatus: Extract<
      OnboardingStatus,
      "started" | "first_value_reached"
    >;
    trigger: string;
    source: string;
    traceId: string;
  }
): Promise<OnboardingTransition> {
  const { data, error } = await client.rpc("advance_onboarding_stage", {
    p_user_id: params.userId,
    p_target_status: params.targetStatus,
    p_trigger: params.trigger,
    p_source: params.source,
    p_trace_id: params.traceId,
  });

  if (error) {
    logger.error("onboarding.advance_stage_failed", {
      error,
      user_id: params.userId,
      target_status: params.targetStatus,
      trigger: params.trigger,
      source: params.source,
      trace_id: params.traceId,
    });
    throw error;
  }

  return OnboardingTransitionSchema.parse(data);
}
