import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgentRuntimeResponse } from "@/agents/runtime";
import type { DedupComparableMovement, DedupDecision } from "@/core/dedup";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;
type RuntimeMetadata = AgentRuntimeResponse<unknown>["runtime"];

export async function recordDedupDecision(
  client: Client,
  input: {
    userId: string;
    incoming: DedupComparableMovement;
    decision: DedupDecision;
    traceId: string;
    runtime?: RuntimeMetadata | null;
    metadata?: Record<string, unknown>;
  },
): Promise<void> {
  const { error } = await client.from("dedup_decisions").upsert(
    {
      user_id: input.userId,
      incoming_reference_id: input.incoming.reference_id,
      incoming_source: input.incoming.source,
      fingerprint: input.decision.fingerprint,
      status: input.decision.status,
      matched_movement_id: input.decision.matched_reference_id,
      score: input.decision.score,
      reasons: input.decision.reasons,
      requires_confirmation: input.decision.requires_confirmation,
      semantic_agent_used: Boolean(input.runtime),
      semantic_agent_provider: input.runtime?.provider ?? null,
      semantic_agent_model: input.runtime?.model_name ?? null,
      trace_id: input.traceId,
      metadata: (input.metadata ?? {}) as Json,
    },
    { onConflict: "user_id,incoming_reference_id" },
  );

  if (error) {
    logger.warn("dedup.decision_record_failed", {
      error,
      user_id: input.userId,
      incoming_reference_id: input.incoming.reference_id,
      status: input.decision.status,
    });
  }
}
