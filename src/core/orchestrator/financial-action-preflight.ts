import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DedupSignalAgent,
} from "@/agents/dedup-signal-agent";
import {
  RiskSignalAgent,
  type RiskSignalAssessment,
  type RiskSignalContextPack,
} from "@/agents/risk-signal-agent";
import {
  evaluateCrossChannelDedup,
  type DedupComparableMovement,
  type DedupDecision,
} from "@/core/dedup";
import type { Database } from "@/data/supabase/types";
import type { RiskLevel } from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";
import {
  summarizeDataActionPlan,
  type DataActionPlan,
  type PlannedDataAction,
} from "./data-action-policy";

type Client = SupabaseClient<Database>;

export type RiskPreflightResult = {
  assessments: RiskSignalAssessment[];
  agent_status: "completed" | "failed" | "not_applicable";
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
};

export type DedupPreflightResult = {
  plan: DataActionPlan;
  decisions: Array<{
    action_id: string;
    decision: DedupDecision;
  }>;
  semantic_agent_runs: number;
  semantic_agent_failures: number;
};

export async function assessRiskSignals(params: {
  agent: RiskSignalAgent;
  userId: string;
  locale: "es-PE";
  timezone: string;
  originalMessage: string;
  actions: RiskSignalContextPack["actions"];
  recentMedianAmount: number | null;
  recentMovementCount: number;
  traceId: string;
}): Promise<RiskPreflightResult> {
  if (params.actions.length === 0) {
    return {
      assessments: [],
      agent_status: "not_applicable",
      provider: null,
      model: null,
      latency_ms: null,
    };
  }

  try {
    const result = await params.agent.assess(
      {
        context_pack_type: "risk_signal_context",
        version: "v1",
        user_id: params.userId,
        locale: params.locale,
        timezone: params.timezone,
        channel: "whatsapp",
        original_message: params.originalMessage,
        actions: params.actions,
        risk_context: {
          recent_amount_median: params.recentMedianAmount,
          recent_movement_count: params.recentMovementCount,
          policy_note:
            "La senal semantica puede elevar riesgo, nunca autorizar ni ejecutar dinero.",
        },
      },
      params.traceId,
    );
    return {
      assessments: result.output.assessments,
      agent_status: "completed",
      provider: result.runtime.provider,
      model: result.runtime.model_name ?? null,
      latency_ms: result.runtime.latency_ms,
    };
  } catch (error) {
    logger.warn("risk.signal_agent_failed", {
      error,
      user_id: params.userId,
      trace_id: params.traceId,
    });
    return {
      assessments: [],
      agent_status: "failed",
      provider: null,
      model: null,
      latency_ms: null,
    };
  }
}

export async function applyDedupPreflight(params: {
  client: Client;
  agent: DedupSignalAgent;
  plan: DataActionPlan;
  recentMovements: DedupComparableMovement[];
  userId: string;
  traceId: string;
}): Promise<DedupPreflightResult> {
  const decisions: DedupPreflightResult["decisions"] = [];
  let semanticAgentRuns = 0;
  let semanticAgentFailures = 0;

  const actions: PlannedDataAction[] = [];
  for (const action of params.plan.actions) {
    if (action.decision !== "ready_for_core" || !action.movement_input) {
      actions.push(action);
      continue;
    }

    const result = await evaluateCrossChannelDedup({
      client: params.client,
      agent: params.agent,
      userId: params.userId,
      traceId: params.traceId,
      referenceId: action.movement_input.source_ref ?? action.action_id,
      movementInput: action.movement_input,
      recentMovements: params.recentMovements,
      metadata: { action_id: action.action_id },
    });
    const decision = result.decision;
    if (!decision) {
      actions.push(action);
      continue;
    }
    if (result.semantic_agent_status !== "not_applicable") {
      semanticAgentRuns += 1;
    }
    if (result.semantic_agent_status === "failed") {
      semanticAgentFailures += 1;
    }
    decisions.push({ action_id: action.action_id, decision });
    actions.push(applyDedupDecision(action, decision));
  }

  return {
    plan: summarizeDataActionPlan(actions),
    decisions,
    semantic_agent_runs: semanticAgentRuns,
    semantic_agent_failures: semanticAgentFailures,
  };
}

export function calculateRecentAmountMedian(
  movements: DedupComparableMovement[],
): number | null {
  const values = movements
    .filter((movement) => movement.amount > 0)
    .map((movement) => movement.amount)
    .sort((left, right) => left - right);
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

function applyDedupDecision(
  action: PlannedDataAction,
  decision: DedupDecision,
): PlannedDataAction {
  if (decision.status === "distinct") return action;

  const reasons = [
    ...new Set([
      ...action.reasons,
      `dedup:${decision.status}`,
      ...decision.reasons.map((reason) => `dedup:${reason}`),
    ]),
  ];
  if (decision.status === "exact_duplicate") {
    return {
      ...action,
      decision: "blocked",
      risk_level: maxRiskLevel(action.risk_level, "high"),
      reasons,
      movement_input: null,
    };
  }

  return {
    ...action,
    decision: "requires_confirmation",
    risk_level: maxRiskLevel(action.risk_level, "medium"),
    reasons,
    movement_input: action.movement_input
      ? {
          ...action.movement_input,
          requires_review: true,
          metadata: {
            ...action.movement_input.metadata,
            policy_reasons: reasons,
            dedup_status: decision.status,
            dedup_matched_reference_id: decision.matched_reference_id,
            dedup_score: decision.score,
          },
        }
      : null,
  };
}

function maxRiskLevel(left: RiskLevel, right: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "sensitive"];
  return order[Math.max(order.indexOf(left), order.indexOf(right))];
}
