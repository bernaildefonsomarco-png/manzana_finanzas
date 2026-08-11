import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  ConversationalExecutiveAgent,
  type ConversationalExecutiveContextPack,
  type ConversationalExecutiveMode,
  type ConversationalExecutiveOutput,
  type ConversationalExecutiveRunResult,
  type ConversationalExecutiveToolExecutor,
  type ExecutiveActionSurface,
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

/**
 * `WEB-D297`: lo que la persona pidio **hacer** en este turno, separado de la
 * autoridad para componer la respuesta.
 *
 * Son dos responsabilidades distintas del mismo resultado y hasta ahora
 * viajaban pegadas: si la respuesta no pasaba validacion, la intencion se caia
 * con ella. Separarlas no crea un segundo camino —la intencion sigue saliendo
 * del mismo `run`, y las cinco ramas siguen leyendo un unico sitio— solo deja
 * de atar una cosa a la otra.
 */
export type ExecutiveActionIntent = Pick<
  ConversationalExecutiveOutput,
  | "memory_control"
  | "structure_proposal"
  | "light_action"
  | "profile_signal"
  | "preference_change"
>;

export const EMPTY_EXECUTIVE_ACTION_INTENT: ExecutiveActionIntent = {
  memory_control: null,
  structure_proposal: null,
  light_action: null,
  profile_signal: null,
  preference_change: null,
};

export type CoordinatedTurnPlan = {
  result: OrchestrationPlanningResult;
  compiled: CompiledOrchestrationPlan;
  /**
   * Autoridad semantica para componer la respuesta. Sigue siendo `null` cuando
   * el ejecutivo no corrio **o cuando su composicion fue rechazada**: nadie
   * puede mostrarle a la persona un texto que no paso validacion.
   */
  executive: ConversationalExecutiveTrace | null;
  /** Unica fuente de la intencion de accion para las cinco ramas del motor. */
  actionIntent: ExecutiveActionIntent;
  /**
   * Lo que la persona pidio y este turno **no** va a hacer, porque el veredicto
   * reprocho ese mismo modulo. Se le tiene que decir (`ERR-ASI-01`).
   */
  droppedActionIntents: ExecutiveActionSurface[];
  /**
   * El ejecutivo produjo una salida tipada este turno, aceptada o no. Es lo que
   * decide si una rama de accion vuelve a pasar por el agente de respuesta:
   * cuando el ejecutivo ya leyo el turno, el texto de la rama va verbatim.
   */
  executiveRan: boolean;
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
          degraded_to_legacy: input.mode === "active",
          error,
        });
      }
    }

    // `WEB-D297`: una composicion rechazada no manda el turno. El plan, la
    // respuesta y las propuestas financieras degradan exactamente como cuando
    // el ejecutivo falla entero —misma via, mismas llamadas, ni una pasada de
    // modelo mas— y lo unico que se salva es la intencion de accion.
    const composed = executiveResult?.compilation.accepted === true;
    if (executiveResult && !composed) {
      logger.warn("turn_coordinator.executive_composition_rejected", {
        trace_id: input.traceId,
        mode: input.mode,
        issue_codes: executiveResult.compilation.issues.map(
          (issue) => issue.code,
        ),
        dropped_action_intents:
          executiveResult.compilation.dropped_action_intents,
      });
    }

    const result =
      input.mode === "active" && executiveResult && composed
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
      input.mode !== "off" && executiveResult && composed
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

    const carried = input.mode !== "off" ? executiveResult : null;

    return {
      result,
      compiled,
      executive,
      actionIntent: carried
        ? actionIntentFrom(carried.output)
        : EMPTY_EXECUTIVE_ACTION_INTENT,
      droppedActionIntents: carried
        ? carried.compilation.dropped_action_intents
        : [],
      executiveRan: carried !== null,
    };
  }
}

/**
 * Los cinco modulos salen del mismo `output` que ya paso por la cuarentena del
 * agente: lo que aqui llegue en `null` es porque este turno decidio no
 * honrarlo, no porque se haya perdido por el camino.
 */
function actionIntentFrom(
  output: ConversationalExecutiveOutput,
): ExecutiveActionIntent {
  return {
    memory_control: output.memory_control,
    structure_proposal: output.structure_proposal,
    light_action: output.light_action,
    profile_signal: output.profile_signal,
    preference_change: output.preference_change,
  };
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
