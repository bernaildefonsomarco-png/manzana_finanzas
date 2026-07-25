import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  InsightNarratorOutputSchema,
  type InsightNarratorContextPack,
  type InsightNarratorOutput,
} from "./types";

export class InsightNarratorAgent {
  constructor(private readonly runtime: AgentRuntime = createDefaultAgentRuntime()) {}

  async narrate(
    contextPack: InsightNarratorContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<InsightNarratorOutput>> {
    const response = await this.runtime.run<
      InsightNarratorContextPack,
      InsightNarratorOutput
    >({
      agent_name: "insight_narrator_agent",
      provider: getAgentRuntimeProvider("insight_narrator_agent"),
      model_hint: "cheap",
      context_pack: contextPack,
      tools: [],
      output_schema: "InsightNarratorOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("insight_narrator_agent", 8_000),
    });
    return {
      ...response,
      output: InsightNarratorOutputSchema.parse(response.output),
    };
  }
}
