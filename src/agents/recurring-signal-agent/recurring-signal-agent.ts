import {
  createDefaultAgentRuntime,
  getAgentRuntimeProvider,
  getAgentRuntimeTimeoutMs,
  type AgentRuntime,
  type AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  RecurringSignalOutputSchema,
  type RecurringSignalContextPack,
  type RecurringSignalOutput,
} from "./types";

export class RecurringSignalAgent {
  constructor(private readonly runtime: AgentRuntime = createDefaultAgentRuntime()) {}

  async assess(
    contextPack: RecurringSignalContextPack,
    traceId: string,
  ): Promise<AgentRuntimeResponse<RecurringSignalOutput>> {
    const response = await this.runtime.run<
      RecurringSignalContextPack,
      RecurringSignalOutput
    >({
      agent_name: "recurring_signal_agent",
      provider: getAgentRuntimeProvider("recurring_signal_agent"),
      model_hint: "cheap",
      context_pack: contextPack,
      tools: [],
      output_schema: "RecurringSignalOutputSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs("recurring_signal_agent", 8_000),
    });

    return {
      ...response,
      output: RecurringSignalOutputSchema.parse(response.output),
    };
  }
}
