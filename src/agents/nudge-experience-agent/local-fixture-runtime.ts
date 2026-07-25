import type { AgentRuntimeRequest, AgentRuntimeResponse } from "@/agents/runtime";
import {
  NudgeExperienceContextPackSchema,
  NudgeExperienceOutputSchema,
} from "./types";

export class LocalFixtureNudgeExperienceAgentRuntime {
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context = NudgeExperienceContextPackSchema.parse(request.context_pack);
    const output = NudgeExperienceOutputSchema.parse({
      response_text: context.deterministic_base_text,
      tone_applied: context.user_context.tone_style ?? "calido_y_breve",
      confidence: 1,
      preserved_fact_keys: Object.keys(context.safe_facts),
    });

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "nudge-experience-fixture-v1",
        latency_ms: 0,
      },
      safety: {
        policy_flags: [
          "copy_only",
          "send_channel_and_timing_are_deterministic",
        ],
        redaction_applied: context.approved_delivery.redaction_applied,
      },
    };
  }
}
