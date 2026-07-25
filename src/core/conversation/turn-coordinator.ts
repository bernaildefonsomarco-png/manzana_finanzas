import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  ConversationalExecutiveAgent,
  type ConversationalExecutiveContextPack,
  type ConversationalExecutiveMode,
  type ConversationalExecutiveRunResult,
  type ConversationalExecutiveToolExecutor,
} from "@/agents/conversational-executive-agent";
import { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import type { OrchestrationPlanningResult } from "@/agents/orchestration-planning-agent/types";
import {
  compileOrchestrationPlan,
  type CompiledOrchestrationPlan,
} from "@/core/orchestrator/orchestration-plan";
import { logger } from "@/shared/telemetry/logger";

export type ConversationalExecutiveTrace = {
  mode: Exclude<ConversationalExecutiveMode, "off">;
  result: ConversationalExecutiveRunResult;
  contextPack: ConversationalExecutiveContextPack;
  divergences: string[];
};

export type CoordinatedTurnPlan = {
  result: OrchestrationPlanningResult;
  compiled: CompiledOrchestrationPlan;
  executive: ConversationalExecutiveTrace | null;
};

export class TurnCoordinator {
  constructor(
    private readonly dependencies: {
      executiveAgent: ConversationalExecutiveAgent;
      legacyPlanningAgent: OrchestrationPlanningAgent;
    },
  ) {}

  async coordinate(input: {
    mode: ConversationalExecutiveMode;
    executiveContext: ConversationalExecutiveContextPack;
    traceId: string;
    workingSet: ConversationWorkingSet | null;
    executeReadOnlyTool: ConversationalExecutiveToolExecutor;
  }): Promise<CoordinatedTurnPlan> {
    let executiveResult: ConversationalExecutiveRunResult | null = null;

    if (input.mode !== "off") {
      try {
        executiveResult = await this.dependencies.executiveAgent.run(
          input.executiveContext,
          input.traceId,
          input.executeReadOnlyTool,
        );
      } catch (error) {
        logger.warn("turn_coordinator.conversational_executive_failed", {
          trace_id: input.traceId,
          mode: input.mode,
          error,
        });
        if (input.mode === "active") throw error;
      }
    }

    const result =
      input.mode === "active"
        ? planningResultFromExecutive(executiveResult)
        : await this.dependencies.legacyPlanningAgent.plan(
            input.executiveContext.planning_context,
            input.traceId,
          );
    const compiled = compileOrchestrationPlan({
      plan: result.output,
      fallbackQuery:
        input.executiveContext.planning_context.kernel_hint.query,
      fallbackTurnState:
        input.executiveContext.planning_context.kernel_hint.turn_state,
      workingSet: input.workingSet,
      receivedAt: input.executiveContext.planning_context.received_at,
    });
    const executive =
      input.mode !== "off" && executiveResult
        ? {
            mode: input.mode,
            result: executiveResult,
            contextPack: input.executiveContext,
            divergences:
              input.mode === "shadow"
                ? compareExecutiveWithLegacy({
                    executive: executiveResult,
                    legacy: result,
                  })
                : [],
          }
        : null;

    return { result, compiled, executive };
  }
}

function planningResultFromExecutive(
  executive: ConversationalExecutiveRunResult | null,
): OrchestrationPlanningResult {
  if (!executive) {
    throw new Error(
      "ConversationalExecutiveAgent activo no devolvio un resultado.",
    );
  }
  return {
    output: executive.output.orchestration_plan,
    runtime: executive.runtime,
    tool_calls: executive.tool_calls,
    safety: executive.safety,
  };
}

function compareExecutiveWithLegacy(input: {
  executive: ConversationalExecutiveRunResult;
  legacy: OrchestrationPlanningResult;
}): string[] {
  const divergences: string[] = [];
  const executivePlan = input.executive.output.orchestration_plan;
  const legacyPlan = input.legacy.output;

  if (executivePlan.goal !== legacyPlan.goal) divergences.push("goal");
  if (executivePlan.workflow !== legacyPlan.workflow) {
    divergences.push("workflow");
  }
  if (executivePlan.semantic_query?.kind !== legacyPlan.semantic_query?.kind) {
    divergences.push("semantic_query_kind");
  }
  if (
    JSON.stringify([...executivePlan.selected_tools].sort()) !==
    JSON.stringify([...legacyPlan.selected_tools].sort())
  ) {
    divergences.push("selected_tools");
  }

  return divergences;
}
