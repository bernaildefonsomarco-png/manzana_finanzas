import { describe, expect, it } from "vitest";
import { composeLocalOrchestrationPlan } from "./local-fixture-runtime";
import type { OrchestrationPlanningContextPack } from "./types";

function buildContext(
  overrides: Partial<OrchestrationPlanningContextPack> = {}
): OrchestrationPlanningContextPack {
  return {
    context_pack_type: "orchestration_context",
    version: "v1",
    user_id: "user-1",
    locale: "es-PE",
    timezone: "America/Lima",
    channel: "whatsapp",
    original_message: "que movimientos hice hoy?",
    received_at: "2026-07-16T15:00:00.000Z",
    kernel_hint: {
      query: {
        kind: "movement_search",
        normalized_text: "que movimientos hice hoy",
        requested_amount: null,
        date_range: null,
        confidence: 0.8,
      },
      turn_state: {
        act: "financial_question",
        continuity: "new_topic",
        emotional_state: "neutral",
        experience_mode: "read_only_answer",
        should_use_active_memory: false,
        should_route_to_conversation_agent: true,
        should_ask_clarification_first: false,
        response_guidance: [],
        personalization_cues: [],
        risk_notes: [],
      },
    },
    active_conversation_state: {
      state_id: null,
      last_intent: null,
      last_query_kind: null,
      last_query_text: null,
      last_result_summary: null,
      referenced_movement_count: 0,
      referenced_entity_count: 0,
      continuity_hint: null,
      expires_at: null,
      working_set: null,
    },
    active_financial_state: {
      capture_draft: null,
      pending_candidates: [],
      account_options: [],
      category_options: [],
    },
    capability_catalog: [],
    constraints: [],
    ...overrides,
  };
}

describe("LocalFixtureOrchestrationPlanningAgentRuntime", () => {
  it("planifica una consulta con una herramienta read-only", () => {
    const plan = composeLocalOrchestrationPlan(buildContext());

    expect(plan.goal).toBe("query");
    expect(plan.selected_tools).toEqual(["query_movements"]);
    expect(plan.steps.map((step) => step.capability)).not.toContain(
      "command_dispatcher"
    );
  });

  it("prioriza el flujo de correccion sin aplicar cambios", () => {
    const context = buildContext({
      original_message: "descarta el ultimo gasto",
      kernel_hint: {
        ...buildContext().kernel_hint,
        turn_state: {
          ...buildContext().kernel_hint.turn_state,
          act: "correction",
          experience_mode: "correction",
        },
      },
    });
    const plan = composeLocalOrchestrationPlan(context);

    expect(plan.goal).toBe("correction");
    expect(plan.requires_confirmation).toBe(true);
    expect(plan.steps.map((step) => step.capability)).toContain(
      "correction_agent"
    );
    expect(plan.steps.map((step) => step.capability)).toContain("policy_gate");
  });

  it("reconoce un turno mixto y ordena Core antes de la consulta", () => {
    const base = buildContext();
    const plan = composeLocalOrchestrationPlan({
      ...base,
      original_message: "registre 20 en desayuno, como voy esta semana?",
      kernel_hint: {
        ...base.kernel_hint,
        turn_state: {
          ...base.kernel_hint.turn_state,
          act: "financial_capture",
          experience_mode: "quick_capture",
        },
      },
    });

    expect(plan.goal).toBe("mixed");
    expect(plan.selected_tools).toContain("query_movements");
    expect(
      plan.steps.findIndex((step) => step.capability === "command_dispatcher")
    ).toBeLessThan(
      plan.steps.findIndex((step) => step.capability === "conversation_agent")
    );
  });
});
