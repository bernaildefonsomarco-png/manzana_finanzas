import {
  createDefaultAgentRuntime,
  getAgentRuntimeTimeoutMs,
  getAgentRuntimeProvider,
  type AgentRuntime,
} from "@/agents/runtime";
import {
  ResponseAgentOutputSchema,
  type ResponseAgentOutput,
  type ResponseContextPack,
} from "./types";

export class ResponseAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime()
  ) {}

  async compose(contextPack: ResponseContextPack, traceId: string): Promise<{
    output: ResponseAgentOutput;
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
    const response = await this.runtime.run<
      ResponseContextPack,
      ResponseAgentOutput
    >({
      agent_name: "response_agent",
      provider: getAgentRuntimeProvider("response_agent"),
      model_hint: "cheap",
      context_pack: contextPack,
      tools: [],
      output_schema: "ResponseAgentOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("response_agent", 10_000),
    });

    return {
      output: ResponseAgentOutputSchema.parse(response.output),
      runtime: response.runtime,
      safety: response.safety,
    };
  }
}
