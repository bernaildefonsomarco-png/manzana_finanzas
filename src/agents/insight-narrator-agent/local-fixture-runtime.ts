import type { AgentRuntimeRequest, AgentRuntimeResponse } from "@/agents/runtime";
import {
  InsightNarratorContextPackSchema,
  InsightNarratorOutputSchema,
} from "./types";

export class LocalFixtureInsightNarratorAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = InsightNarratorContextPackSchema.parse(request.context_pack);
    const copy = context.candidate.deterministic_copy;
    const output = InsightNarratorOutputSchema.parse({
      title: copy.title,
      body: copy.body,
      evidence_text: copy.evidence_text,
      action_label: copy.action_label,
      confidence: 1,
      preserved_fact_keys: Object.keys(context.candidate.safe_facts),
    });
    return {
      output: output as TOutput,
      confidence: 1,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "insight-narrator-fixture-v1",
        latency_ms: 0,
      },
      safety: {
        policy_flags: ["copy_only", "facts_are_immutable"],
        redaction_applied: false,
      },
    };
  }
}
