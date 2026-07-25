import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  LearningSignalOutputSchema,
  type LearningSignalContextPack,
  type LearningSignalOutput,
} from "./types";

export class LearningSignalAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime(),
  ) {}

  async propose(
    contextPack: LearningSignalContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<LearningSignalOutput>> {
    const response = await this.runtime.run<
      LearningSignalContextPack,
      LearningSignalOutput
    >({
      agent_name: "learning_signal_agent",
      provider: getAgentRuntimeProvider("learning_signal_agent"),
      model_hint: "balanced",
      context_pack: contextPack,
      tools: [],
      output_schema: "LearningSignalOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("learning_signal_agent", 12_000),
    });

    return {
      ...response,
      output: LearningSignalOutputSchema.parse(response.output),
    };
  }
}
