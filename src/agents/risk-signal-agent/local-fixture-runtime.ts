import type {
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  RiskSignalContextPackSchema,
  RiskSignalOutputSchema,
} from "./types";

export class LocalFixtureRiskSignalAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = RiskSignalContextPackSchema.parse(request.context_pack);
    const assessments = context.actions.map((action) => {
      const signals = action.category_sensitive ? ["sensitive_category"] : [];
      return {
        action_id: action.action_id,
        semantic_level: action.category_sensitive ? "sensitive" as const : "none" as const,
        signals,
        confidence: 1,
        requires_confirmation_advisory: action.category_sensitive,
        safe_explanation: action.category_sensitive
          ? "La categoria requiere tratamiento sensible."
          : "No hay una senal semantica adicional en el fixture.",
      };
    });
    const output = RiskSignalOutputSchema.parse({
      assessments,
      confidence: 1,
      safe_explanation: "Evaluacion semantica local sin autoridad de ejecucion.",
    });

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: { provider: "local_fixture", model_name: "risk-fixture-v1", latency_ms: 0 },
      safety: {
        policy_flags: ["proposal_only", "risk_policy_remains_deterministic"],
        redaction_applied: false,
      },
    };
  }
}
