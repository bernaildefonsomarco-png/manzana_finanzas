import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  DedupSignalOutputSchema,
  type DedupSignalContextPack,
  type DedupSignalOutput,
} from "./types";

export class DedupSignalAgent {
  constructor(private readonly runtime: AgentRuntime = createDefaultAgentRuntime()) {}

  async assess(
    contextPack: DedupSignalContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<DedupSignalOutput>> {
    const response = await this.runtime.run<DedupSignalContextPack, DedupSignalOutput>({
      agent_name: "dedup_signal_agent",
      provider: getAgentRuntimeProvider("dedup_signal_agent"),
      model_hint: "cheap",
      context_pack: contextPack,
      tools: [],
      output_schema: "DedupSignalOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("dedup_signal_agent", 8_000),
    });
    return { ...response, output: DedupSignalOutputSchema.parse(response.output) };
  }
}
