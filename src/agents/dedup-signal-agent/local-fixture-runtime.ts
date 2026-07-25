import type { AgentRuntimeRequest, AgentRuntimeResponse } from "@/agents/runtime";
import {
  DedupSignalContextPackSchema,
  DedupSignalOutputSchema,
} from "./types";

export class LocalFixtureDedupSignalAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = DedupSignalContextPackSchema.parse(request.context_pack);
    const output = DedupSignalOutputSchema.parse({
      assessments: context.candidates.map((candidate) => ({
        candidate_reference_id: candidate.reference_id,
        relation: candidate.deterministic_score >= 0.9
          ? "possibly_same"
          : "different",
        confidence: candidate.deterministic_score,
        evidence_signals: candidate.deterministic_reasons,
        safe_explanation: "El fixture conserva la similitud deterministica como senal consultiva.",
      })),
      confidence: 1,
      safe_explanation: "Evaluacion semantica local sin descartar ni escribir movimientos.",
    });
    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: { provider: "local_fixture", model_name: "dedup-fixture-v1", latency_ms: 0 },
      safety: {
        policy_flags: ["proposal_only", "dedup_gate_remains_deterministic"],
        redaction_applied: false,
      },
    };
  }
}
