import type { AgentRuntimeRequest, AgentRuntimeResponse } from "@/agents/runtime";
import {
  InsightExperienceContextPackSchema,
  InsightExperienceOutputSchema,
} from "./types";

export class LocalFixtureInsightExperienceAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = InsightExperienceContextPackSchema.parse(request.context_pack);
    const type = context.candidate.type;
    const sensitive = context.candidate.risk_level === "sensitive";
    const framing =
      type === "learning_progress"
        ? "learning"
        : type === "progress"
          ? "progress"
          : type === "data_quality"
            ? "data_quality"
            : type === "anomaly"
              ? "gentle_attention"
              : type === "temporal_pattern" || type === "category_concentration"
                ? "pattern"
                : type === "free_money" || type === "box_saving"
                  ? "clarity"
                : "change";
    const output = InsightExperienceOutputSchema.parse({
      display_recommendation: sensitive ? "dashboard_only" : "now",
      framing_angle: framing,
      depth: context.candidate.rank_score >= 75 ? "actionable" : "brief",
      recommended_channel: sensitive ? "dashboard" : "dashboard",
      hold_reason: null,
      confidence: 1,
      preserved_fact_keys: Object.keys(context.candidate.safe_facts),
    });
    return {
      output: output as TOutput,
      confidence: 1,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "insight-experience-fixture-v1",
        latency_ms: 0,
      },
      safety: {
        policy_flags: ["framing_only", "facts_are_immutable"],
        redaction_applied: false,
      },
    };
  }
}
