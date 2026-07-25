import {
  createDefaultAgentRuntime,
  getAgentRuntimeTimeoutMs,
  getAgentRuntimeProvider,
  type AgentRuntime,
} from "@/agents/runtime";
import {
  DataAgentOutputSchema,
  type DataAgentOutput,
  type DataContextPack,
} from "./types";

export class DataAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime()
  ) {}

  async extract(contextPack: DataContextPack, traceId: string): Promise<{
    output: DataAgentOutput;
    runtime: {
      provider: string;
      model_name?: string;
      latency_ms: number;
      cost_estimate?: number;
    };
    safety: {
      policy_flags: string[];
      redaction_applied: boolean;
    };
  }> {
    const response = await this.runtime.run<DataContextPack, DataAgentOutput>({
      agent_name: "data_agent",
      provider: getAgentRuntimeProvider("data_agent"),
      model_hint: "cheap",
      context_pack: contextPack,
      tools: [],
      output_schema: "DataAgentOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("data_agent", 10_000),
    });

    return {
      output: DataAgentOutputSchema.parse(response.output),
      runtime: response.runtime,
      safety: response.safety,
    };
  }
}
