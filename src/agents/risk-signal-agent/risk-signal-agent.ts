import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  RiskSignalOutputSchema,
  type RiskSignalContextPack,
  type RiskSignalOutput,
} from "./types";

export class RiskSignalAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime(),
  ) {}

  async assess(
    contextPack: RiskSignalContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<RiskSignalOutput>> {
    const response = await this.runtime.run<RiskSignalContextPack, RiskSignalOutput>({
      agent_name: "risk_signal_agent",
      provider: getAgentRuntimeProvider("risk_signal_agent"),
      model_hint: "balanced",
      context_pack: contextPack,
      tools: [],
      output_schema: "RiskSignalOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("risk_signal_agent", 10_000),
    });

    return { ...response, output: RiskSignalOutputSchema.parse(response.output) };
  }
}
