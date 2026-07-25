import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  DisclosureExperienceOutputSchema,
  type DisclosureExperienceContextPack,
  type DisclosureExperienceOutput,
} from "./types";

export class DisclosureExperienceAgent {
  constructor(private readonly runtime: AgentRuntime = createDefaultAgentRuntime()) {}

  async frame(
    contextPack: DisclosureExperienceContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<DisclosureExperienceOutput>> {
    const response = await this.runtime.run<
      DisclosureExperienceContextPack,
      DisclosureExperienceOutput
    >({
      agent_name: "disclosure_experience_agent",
      provider: getAgentRuntimeProvider("disclosure_experience_agent"),
      model_hint: "cheap",
      context_pack: contextPack,
      tools: [],
      output_schema: "DisclosureExperienceOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("disclosure_experience_agent", 8_000),
    });
    return {
      ...response,
      output: DisclosureExperienceOutputSchema.parse(response.output),
    };
  }
}
