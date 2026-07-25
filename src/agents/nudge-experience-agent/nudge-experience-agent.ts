import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  NudgeExperienceOutputSchema,
  type NudgeExperienceContextPack,
  type NudgeExperienceOutput,
} from "./types";

export class NudgeExperienceAgent {
  constructor(private readonly runtime: AgentRuntime = createDefaultAgentRuntime()) {}

  async frame(
    contextPack: NudgeExperienceContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<NudgeExperienceOutput>> {
    const response = await this.runtime.run<
      NudgeExperienceContextPack,
      NudgeExperienceOutput
    >({
      agent_name: "nudge_experience_agent",
      provider: getAgentRuntimeProvider("nudge_experience_agent"),
      model_hint: "cheap",
      context_pack: contextPack,
      tools: [],
      output_schema: "NudgeExperienceOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("nudge_experience_agent", 8_000),
    });

    return {
      ...response,
      output: NudgeExperienceOutputSchema.parse(response.output),
    };
  }
}
