import type { SupabaseClient } from "@supabase/supabase-js";
import { advanceOnboardingStage } from "@/data/repositories/onboarding.repository";
import type { Database } from "@/data/supabase/types";
import type { OnboardingStatus } from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

export type InitialOnboardingStage =
  | "registered_without_use"
  | "onboarding_started"
  | "first_value"
  | "beyond_initial_cut"
  | "paused";

export type InitialOnboardingSummary = {
  persisted_status: OnboardingStatus;
  effective_status: OnboardingStatus;
  stage: InitialOnboardingStage;
  first_value_kind: "movement" | "debt" | null;
  show_initial_prompt: boolean;
  show_first_value_tip: boolean;
};

const STATUS_RANK: Record<OnboardingStatus, number> = {
  not_started: 0,
  started: 1,
  first_value_reached: 2,
  activated_light: 3,
  activated_strong: 4,
  completed: 5,
  paused: -1,
};

export function deriveInitialOnboardingSummary(input: {
  persistedStatus: OnboardingStatus;
  confirmedMovementsCount: number;
  debtsCount: number;
}): InitialOnboardingSummary {
  const hasMovementValue = input.confirmedMovementsCount > 0;
  const hasDebtValue = input.debtsCount > 0;
  const hasFirstValue = hasMovementValue || hasDebtValue;
  const effectiveStatus =
    input.persistedStatus !== "paused" &&
    hasFirstValue &&
    STATUS_RANK[input.persistedStatus] < STATUS_RANK.first_value_reached
      ? ("first_value_reached" as const)
      : input.persistedStatus;
  const firstValueKind = hasMovementValue
    ? ("movement" as const)
    : hasDebtValue
      ? ("debt" as const)
      : null;

  return {
    persisted_status: input.persistedStatus,
    effective_status: effectiveStatus,
    stage: toInitialStage(effectiveStatus),
    first_value_kind: firstValueKind,
    show_initial_prompt:
      !hasFirstValue &&
      (effectiveStatus === "not_started" || effectiveStatus === "started"),
    show_first_value_tip:
      hasFirstValue &&
      effectiveStatus === "first_value_reached" &&
      input.confirmedMovementsCount < 5,
  };
}

export async function startInitialOnboarding(
  client: Client,
  params: { userId: string; source: string; traceId: string }
) {
  return advanceOnboardingStage(client, {
    userId: params.userId,
    targetStatus: "started",
    trigger: "initial_action_selected",
    source: params.source,
    traceId: params.traceId,
  });
}

export async function recordInitialOnboardingValue(
  client: Client,
  params: {
    userId: string;
    trigger: "movement_confirmed" | "pending_confirmed" | "debt_created";
    source: string;
    traceId: string;
  }
) {
  return advanceOnboardingStage(client, {
    userId: params.userId,
    targetStatus: "first_value_reached",
    trigger: params.trigger,
    source: params.source,
    traceId: params.traceId,
  });
}

function toInitialStage(status: OnboardingStatus): InitialOnboardingStage {
  if (status === "paused") return "paused";
  if (status === "not_started") return "registered_without_use";
  if (status === "started") return "onboarding_started";
  if (status === "first_value_reached") return "first_value";
  return "beyond_initial_cut";
}
