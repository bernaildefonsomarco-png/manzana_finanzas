import type { AgentRuntimeRequest, AgentRuntimeResponse } from "@/agents/runtime";
import {
  DisclosureExperienceContextPackSchema,
  DisclosureExperienceOutputSchema,
} from "./types";

export class LocalFixtureDisclosureExperienceAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = DisclosureExperienceContextPackSchema.parse(request.context_pack);
    const output = DisclosureExperienceOutputSchema.parse({
      response_text: context.base_text,
      progressive_disclosure_hint: context.redaction_applied
        ? "Escribe ver para revisar el detalle."
        : null,
      confidence: 1,
      preserved_fact_keys: Object.keys(context.safe_facts),
    });
    return {
      output: output as TOutput,
      confidence: 1,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "disclosure-fixture-v1",
        latency_ms: 0,
      },
      safety: {
        policy_flags: ["copy_only", "deterministic_redaction_preapplied"],
        redaction_applied: context.redaction_applied,
      },
    };
  }
}
