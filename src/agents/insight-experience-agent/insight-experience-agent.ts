import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  InsightExperienceOutputSchema,
  type InsightExperienceContextPack,
  type InsightExperienceOutput,
} from "./types";

export class InsightExperienceAgent {
  constructor(private readonly runtime: AgentRuntime = createDefaultAgentRuntime()) {}

  async evaluate(
    contextPack: InsightExperienceContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<InsightExperienceOutput>> {
    const response = await this.runtime.run<
      InsightExperienceContextPack,
      InsightExperienceOutput
    >({
      agent_name: "insight_experience_agent",
      provider: getAgentRuntimeProvider("insight_experience_agent"),
      model_hint: "balanced",
      context_pack: contextPack,
      tools: [],
      output_schema: "InsightExperienceOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("insight_experience_agent", 10_000),
    });
    return {
      ...response,
      output: InsightExperienceOutputSchema.parse(response.output),
    };
  }
}
