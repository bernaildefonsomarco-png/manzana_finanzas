import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DedupSignalAgent,
  type DedupSignalContextPack,
  type DedupSignalOutput,
} from "@/agents/dedup-signal-agent";
import { recordDedupDecision } from "@/data/repositories/dedup-decisions.repository";
import { listRecentMovementsForPreflight } from "@/data/repositories/movements.repository";
import type { Database } from "@/data/supabase/types";
import type { MovementInput } from "@/shared/schemas/money";
import { logger } from "@/shared/telemetry/logger";
import {
  decideDedup,
  movementInputToDedupComparable,
  prefilterDedupCandidates,
  type DedupComparableMovement,
  type DedupDecision,
} from "./dedup-engine";

type Client = SupabaseClient<Database>;

export type CrossChannelDedupResult = {
  decision: DedupDecision | null;
  candidate_count: number;
  semantic_agent_status: "completed" | "failed" | "not_applicable";
  semantic_agent_provider: string | null;
  semantic_agent_model: string | null;
  semantic_agent_latency_ms: number | null;
};

export async function evaluateCrossChannelDedup(params: {
  client: Client;
  userId: string;
  traceId: string;
  referenceId: string;
  movementInput: MovementInput;
  recentMovements?: DedupComparableMovement[];
  agent?: DedupSignalAgent;
  metadata?: Record<string, unknown>;
}): Promise<CrossChannelDedupResult> {
  const incoming = movementInputToDedupComparable(
    params.referenceId,
    params.movementInput,
  );
  if (!incoming) {
    return {
      decision: null,
      candidate_count: 0,
      semantic_agent_status: "not_applicable",
      semantic_agent_provider: null,
      semantic_agent_model: null,
      semantic_agent_latency_ms: null,
    };
  }

  const recentMovements = params.recentMovements ??
    await listRecentMovementsForPreflight(params.client, params.userId);
  const candidates = prefilterDedupCandidates(incoming, recentMovements);
  let semantic: DedupSignalOutput | null = null;
  let runtime: {
    provider: "codex" | "api" | "local_fixture";
    model_name?: string;
    latency_ms: number;
    cost_estimate?: number;
  } | null = null;
  let semanticStatus: CrossChannelDedupResult["semantic_agent_status"] =
    "not_applicable";

  if (needsSemanticDedup(candidates)) {
    semanticStatus = "failed";
    try {
      const result = await (params.agent ?? new DedupSignalAgent()).assess(
        buildDedupContextPack(params.userId, incoming, candidates),
        params.traceId,
      );
      semantic = result.output;
      runtime = result.runtime;
      semanticStatus = "completed";
    } catch (error) {
      logger.warn("dedup.signal_agent_failed", {
        error,
        user_id: params.userId,
        incoming_reference_id: params.referenceId,
        trace_id: params.traceId,
      });
    }
  }

  const decision = decideDedup({ incoming, candidates, semantic });
  await recordDedupDecision(params.client, {
    userId: params.userId,
    incoming,
    decision,
    traceId: params.traceId,
    runtime,
    metadata: {
      ...params.metadata,
      candidate_count: candidates.length,
      semantic_agent_status: semanticStatus,
    },
  });

  return {
    decision,
    candidate_count: candidates.length,
    semantic_agent_status: semanticStatus,
    semantic_agent_provider: runtime?.provider ?? null,
    semantic_agent_model: runtime?.model_name ?? null,
    semantic_agent_latency_ms: runtime?.latency_ms ?? null,
  };
}

function needsSemanticDedup(
  candidates: ReturnType<typeof prefilterDedupCandidates>,
): boolean {
  const best = candidates[0];
  return Boolean(
    best &&
      best.deterministic_score >= 0.62 &&
      best.deterministic_score < 0.92
  );
}

function buildDedupContextPack(
  userId: string,
  incoming: DedupComparableMovement,
  candidates: ReturnType<typeof prefilterDedupCandidates>,
): DedupSignalContextPack {
  return {
    context_pack_type: "dedup_signal_context",
    version: "v1",
    user_id: userId,
    incoming: toAgentComparable(incoming),
    candidates: candidates.map((candidate) => ({
      ...toAgentComparable(candidate),
      deterministic_score: candidate.deterministic_score,
      deterministic_reasons: candidate.deterministic_reasons,
    })),
  };
}

function toAgentComparable(movement: DedupComparableMovement) {
  return {
    reference_id: movement.reference_id,
    movement_type: movement.movement_type,
    amount: movement.amount,
    currency: movement.currency,
    occurred_at: movement.occurred_at,
    description: movement.description,
    merchant: movement.merchant,
    source: movement.source,
  };
}
