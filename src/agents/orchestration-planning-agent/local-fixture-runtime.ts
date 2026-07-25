import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  defaultToolsForConversationQuery,
  OrchestrationPlanSchema,
  type PlanningCapability,
  type PlanningStepKind,
  type OrchestrationPlan,
  type OrchestrationPlanningContextPack,
} from "./types";

export class LocalFixtureOrchestrationPlanningAgentRuntime
  implements AgentRuntime
{
  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    if (request.agent_name !== "orchestration_planning_agent") {
      throw new Error(
        "LocalFixtureOrchestrationPlanningAgentRuntime solo soporta orchestration_planning_agent"
      );
    }

    const startedAt = Date.now();
    const output = composeLocalOrchestrationPlan(
      request.context_pack as OrchestrationPlanningContextPack
    );

    return {
      output: output as TOutput,
      confidence: output.confidence,
      tool_calls: output.selected_tools.map((toolName) => ({
        tool_name: toolName,
        status: "skipped" as const,
      })),
      runtime: {
        provider: "local_fixture",
        model_name: "local-orchestration-planner-fixture-v1",
        latency_ms: Date.now() - startedAt,
        cost_estimate: 0,
      },
      safety: {
        policy_flags: [
          "local_fixture",
          "plan_only",
          "no_direct_financial_write",
        ],
        redaction_applied: false,
      },
    };
  }
}

export function composeLocalOrchestrationPlan(
  context: OrchestrationPlanningContextPack
): OrchestrationPlan {
  const { query, turn_state: turnState } = context.kernel_hint;
  const normalized = context.original_message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (turnState.act === "correction") {
    return OrchestrationPlanSchema.parse({
      ...semanticFields(query, turnState),
      goal: "correction",
      workflow: "correction_review",
      steps: [
        step("correction", "agent", "correction_agent", [], "Interpretar la correccion."),
        step(
          "policy",
          "policy_check",
          "policy_gate",
          ["correction"],
          "Exigir confirmacion si afecta dinero o historial."
        ),
        step(
          "response",
          "response",
          "response_agent",
          ["policy"],
          "Explicar lo entendido sin aplicar cambios."
        ),
      ],
      conversation_query_kind: null,
      selected_tools: [],
      response_strategy: "confirm",
      requires_confirmation: true,
      risk_flags: ["financial_correction"],
      confidence: 0.78,
    });
  }

  const looksMixed =
    turnState.act === "financial_capture" &&
    /\?/.test(context.original_message) &&
    /\b(como voy|como va|cuanto llevo|esta semana|este mes|dinero libre|me queda)\b/.test(
      normalized
    );
  if (looksMixed) {
    const queryKind = query.kind === "unsupported" ? "movement_search" : query.kind;
    return OrchestrationPlanSchema.parse({
      ...semanticFields({ ...query, kind: queryKind }, turnState),
      goal: "mixed",
      workflow: "mixed_capture_and_query",
      steps: [
        step("extract", "agent", "data_agent", [], "Extraer el movimiento propuesto."),
        step(
          "policy",
          "policy_check",
          "policy_gate",
          ["extract"],
          "Validar riesgo y confirmacion antes de Core."
        ),
        step(
          "core",
          "core_command",
          "command_dispatcher",
          ["policy"],
          "Ejecutar solo si Core autoriza."
        ),
        step(
          "lookup",
          "tool",
          defaultToolsForConversationQuery(queryKind)[0] ?? "query_movements",
          ["core"],
          "Consultar evidencia para la pregunta adicional."
        ),
        step(
          "answer",
          "agent",
          "conversation_agent",
          ["lookup"],
          "Responder la pregunta con datos confirmados."
        ),
      ],
      conversation_query_kind: queryKind,
      selected_tools: defaultToolsForConversationQuery(queryKind),
      response_strategy: "mixed",
      requires_confirmation: false,
      risk_flags: ["mixed_intent"],
      confidence: 0.72,
    });
  }

  if (
    query.kind !== "unsupported" ||
    turnState.act === "financial_follow_up" ||
    turnState.act === "financial_reconstruction" ||
    turnState.act === "financial_question"
  ) {
    const selectedTools = defaultToolsForConversationQuery(query.kind);
    return OrchestrationPlanSchema.parse({
      ...semanticFields(query, turnState),
      goal: "query",
      workflow: "conversation_read_only",
      steps: [
        ...selectedTools.map((tool, index) =>
          step(`tool_${index + 1}`, "tool", tool, [], "Consultar evidencia read-only autorizada.")
        ),
        step(
          "answer",
          "agent",
          "conversation_agent",
          selectedTools.map((_, index) => `tool_${index + 1}`),
          "Responder con evidencia y continuidad."
        ),
        step(
          "response",
          "response",
          "response_agent",
          ["answer"],
          "Ajustar tono sin cambiar hechos."
        ),
      ],
      conversation_query_kind: query.kind,
      selected_tools: selectedTools,
      response_strategy: "explain",
      requires_confirmation: false,
      risk_flags: ["read_only"],
      confidence: query.confidence,
    });
  }

  if (turnState.act === "financial_capture") {
    return OrchestrationPlanSchema.parse({
      ...semanticFields(null, turnState),
      goal: "record",
      workflow: "financial_capture",
      steps: [
        step("extract", "agent", "data_agent", [], "Extraer propuesta financiera."),
        step(
          "policy",
          "policy_check",
          "policy_gate",
          ["extract"],
          "Validar propuesta y confirmaciones."
        ),
        step(
          "core",
          "core_command",
          "command_dispatcher",
          ["policy"],
          "Ejecutar solo por Core si esta permitido."
        ),
        step(
          "response",
          "response",
          "response_agent",
          ["core"],
          "Responder con estado real de la accion."
        ),
      ],
      conversation_query_kind: null,
      selected_tools: [],
      response_strategy: "acknowledge",
      requires_confirmation: false,
      risk_flags: ["financial_write_requires_core"],
      confidence: 0.76,
    });
  }

  return OrchestrationPlanSchema.parse({
    ...semanticFields(null, turnState),
    goal: "help",
    workflow: "support",
    steps: [
      step(
        "response",
        "response",
        "response_agent",
        [],
        "Responder de forma breve y mantener disponibilidad."
      ),
    ],
    conversation_query_kind: null,
    selected_tools: [],
    response_strategy: "acknowledge",
    requires_confirmation: false,
    risk_flags: ["no_financial_write"],
    confidence: 0.58,
  });
}

function semanticFields(
  query: OrchestrationPlanningContextPack["kernel_hint"]["query"] | null,
  turnState: OrchestrationPlanningContextPack["kernel_hint"]["turn_state"],
) {
  return {
    semantic_query: query && query.kind !== "unsupported" ? query : null,
    semantic_turn: {
      ...turnState,
      response_guidance: turnState.response_guidance.slice(0, 10),
      personalization_cues: turnState.personalization_cues.slice(0, 8),
      risk_notes: turnState.risk_notes.slice(0, 8),
    },
    pending_operation_resolution: "none" as const,
    financial_resolution: {
      action: "none" as const,
      target: "none" as const,
      pending_code: null,
      account_origin_id: null,
      account_destination_id: null,
      category_id: null,
      learn_account_aliases: false,
      confidence: 0,
    },
    style_update: null,
  };
}

function step(
  stepId: string,
  kind: PlanningStepKind,
  capability: PlanningCapability,
  dependsOn: string[],
  purpose: string
) {
  return {
    step_id: stepId,
    kind,
    capability,
    depends_on: dependsOn,
    purpose,
  };
}
