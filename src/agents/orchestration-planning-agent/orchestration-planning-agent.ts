import {
  createDefaultAgentRuntime,
  getAgentRuntimeTimeoutMs,
  getAgentRuntimeProvider,
  type AgentRuntime,
  type ToolCallSummary,
} from "@/agents/runtime";
import {
  ORCHESTRATION_CAPABILITY_CATALOG,
  OrchestrationPlanSchema,
  type OrchestrationPlan,
  type OrchestrationPlanningContextPack,
} from "./types";

export class OrchestrationPlanningAgent {
  constructor(
    private readonly runtime: AgentRuntime = createDefaultAgentRuntime()
  ) {}

  async plan(
    contextPack: OrchestrationPlanningContextPack,
    traceId: string
  ): Promise<{
    output: OrchestrationPlan;
    runtime: {
      provider: string;
      model_name?: string;
      latency_ms: number;
      cost_estimate?: number;
    };
    tool_calls: ToolCallSummary[];
    safety: {
      policy_flags: string[];
      redaction_applied: boolean;
    };
  }> {
    const response = await this.runtime.run<
      OrchestrationPlanningContextPack,
      OrchestrationPlan
    >({
      agent_name: "orchestration_planning_agent",
      provider: getAgentRuntimeProvider("orchestration_planning_agent"),
      model_hint: "strong",
      context_pack: contextPack,
      tools: ORCHESTRATION_CAPABILITY_CATALOG.filter(
        (capability) => capability.kind === "tool"
      ).map((capability) => ({
        name: capability.name,
        description: capability.description,
        readOnly: capability.read_only,
      })),
      output_schema: "OrchestrationPlanSchema@v1",
      trace_id: traceId,
      timeout_ms: getAgentRuntimeTimeoutMs(
        "orchestration_planning_agent",
        15_000
      ),
    });

    return {
      output: OrchestrationPlanSchema.parse(response.output),
      runtime: response.runtime,
      tool_calls: response.tool_calls,
      safety: response.safety,
    };
  }
}
