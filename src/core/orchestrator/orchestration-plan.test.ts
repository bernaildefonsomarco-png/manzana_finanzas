import { describe, expect, it } from "vitest";
import {
  compileOrchestrationPlan,
  reconcileCompiledOrchestrationPlan,
} from "./orchestration-plan";

const fallbackQuery = {
  kind: "movement_search" as const,
  normalized_text: "que hice hoy",
  requested_amount: null,
  date_range: null,
  confidence: 0.65,
};

const financialQuestionTurn = {
  act: "financial_question" as const,
  continuity: "new_topic" as const,
  emotional_state: "neutral" as const,
  experience_mode: "read_only_answer" as const,
  should_use_active_memory: false,
  should_route_to_conversation_agent: true,
  should_ask_clarification_first: false,
  response_guidance: [],
  personalization_cues: [],
  risk_notes: [],
};

const semanticPlanDefaults = {
  semantic_query: null,
  semantic_turn: financialQuestionTurn,
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

const compileDefaults = {
  fallbackTurnState: financialQuestionTurn,
  receivedAt: "2026-07-17T10:00:00.000-05:00",
};

describe("compileOrchestrationPlan", () => {
  it("mantiene una consulta dentro del ToolGateway autorizado", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery,
      plan: {
        ...semanticPlanDefaults,
        goal: "query",
        workflow: "conversation_read_only",
        steps: [
          {
            step_id: "lookup",
            kind: "tool",
            capability: "query_movements",
            depends_on: [],
            purpose: "Buscar movimientos confirmados.",
          },
          {
            step_id: "answer",
            kind: "agent",
            capability: "conversation_agent",
            depends_on: ["lookup"],
            purpose: "Explicar resultados.",
          },
        ],
        conversation_query_kind: "movement_search",
        selected_tools: ["query_movements", "query_movements"],
        response_strategy: "explain",
        requires_confirmation: false,
        risk_flags: ["read_only"],
        confidence: 0.9,
      },
    });

    expect(compiled.route).toBe("conversation_agent");
    expect(compiled.selectedTools).toEqual(["query_movements"]);
    expect(compiled.rejectedStepCount).toBe(0);
  });

  it("no permite que un plan de consulta autorice un comando financiero", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery,
      plan: {
        ...semanticPlanDefaults,
        goal: "query",
        workflow: "conversation_read_only",
        steps: [
          {
            step_id: "bad-core",
            kind: "core_command",
            capability: "command_dispatcher",
            depends_on: [],
            purpose: "No permitido para una consulta.",
          },
        ],
        conversation_query_kind: "movement_search",
        selected_tools: [],
        response_strategy: "explain",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.7,
      },
    });

    expect(compiled.route).toBe("conversation_agent");
    expect(compiled.rejectedStepCount).toBe(1);
  });

  it("impone confirmacion aunque el modelo la omita en una correccion", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery,
      plan: {
        ...semanticPlanDefaults,
        goal: "correction",
        workflow: "correction_review",
        steps: [
          {
            step_id: "interpret",
            kind: "agent",
            capability: "correction_agent",
            depends_on: [],
            purpose: "Resolver la referencia sin escribir Core.",
          },
          {
            step_id: "policy",
            kind: "policy_check",
            capability: "policy_gate",
            depends_on: ["interpret"],
            purpose: "Exigir confirmacion antes de cualquier cambio.",
          },
        ],
        conversation_query_kind: null,
        selected_tools: [],
        response_strategy: "clarify",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.83,
      },
    });

    expect(compiled.route).toBe("correction_agent");
    expect(compiled.requiresConfirmation).toBe(true);
    expect(compiled.riskFlags).toContain("confirmation_enforced_by_compiler");
  });

  it("reconcilia una consulta con acciones financieras como flujo mixto", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery,
      plan: {
        ...semanticPlanDefaults,
        goal: "query",
        workflow: "conversation_read_only",
        steps: [
          {
            step_id: "lookup",
            kind: "tool",
            capability: "query_movements",
            depends_on: [],
            purpose: "Consultar el estado semanal.",
          },
        ],
        conversation_query_kind: "movement_search",
        selected_tools: ["query_movements"],
        response_strategy: "explain",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.84,
      },
    });

    const reconciled = reconcileCompiledOrchestrationPlan({
      compiled,
      proposedActionCount: 1,
      turnState: financialQuestionTurn,
    });

    expect(reconciled.goal).toBe("mixed");
    expect(reconciled.workflow).toBe("mixed_capture_and_query");
    expect(reconciled.route).toBe("data_agent");
    expect(reconciled.runConversationAfterFinancialAction).toBe(true);
    expect(reconciled.selectedTools).toEqual(["query_movements"]);
    expect(reconciled.riskFlags).toContain("goal_reconciled_query_to_mixed");
  });

  it("recupera las herramientas si el planner vio captura pero el kernel vio pregunta", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery,
      plan: {
        ...semanticPlanDefaults,
        goal: "record",
        workflow: "financial_capture",
        steps: [
          {
            step_id: "capture",
            kind: "agent",
            capability: "data_agent",
            depends_on: [],
            purpose: "Extraer el movimiento.",
          },
        ],
        conversation_query_kind: "movement_search",
        selected_tools: [],
        response_strategy: "acknowledge",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.78,
      },
    });

    const reconciled = reconcileCompiledOrchestrationPlan({
      compiled,
      proposedActionCount: 1,
      turnState: financialQuestionTurn,
    });

    expect(reconciled.goal).toBe("mixed");
    expect(reconciled.selectedTools).toEqual(["query_movements"]);
    expect(reconciled.riskFlags).toContain("goal_reconciled_record_to_mixed");
  });

  it("mantiene una captura simple sin convertirla en consulta", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: {
        ...fallbackQuery,
        kind: "unsupported",
      },
      plan: {
        ...semanticPlanDefaults,
        goal: "record",
        workflow: "financial_capture",
        steps: [
          {
            step_id: "capture",
            kind: "agent",
            capability: "data_agent",
            depends_on: [],
            purpose: "Extraer el movimiento.",
          },
        ],
        conversation_query_kind: null,
        selected_tools: [],
        response_strategy: "acknowledge",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.91,
      },
    });

    const reconciled = reconcileCompiledOrchestrationPlan({
      compiled,
      proposedActionCount: 1,
      turnState: {
        ...financialQuestionTurn,
        act: "financial_capture",
        experience_mode: "quick_capture",
        should_route_to_conversation_agent: false,
      },
    });

    expect(reconciled).toEqual(compiled);
  });

  it("conserva el rango entendido semanticamente sin reconstruirlo con el router", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: {
        ...fallbackQuery,
        date_range: null,
      },
      plan: {
        ...semanticPlanDefaults,
        semantic_query: {
          kind: "movement_search",
          normalized_text: "ayer tuve movimientos",
          requested_amount: null,
          date_range: {
            start: "2026-07-16T00:00:00.000-05:00",
            end: "2026-07-16T23:59:59.999-05:00",
            label: "ayer",
          },
          confidence: 0.96,
        },
        goal: "query",
        workflow: "conversation_read_only",
        steps: [],
        conversation_query_kind: "movement_search",
        selected_tools: ["query_movements"],
        response_strategy: "explain",
        requires_confirmation: false,
        risk_flags: ["read_only"],
        confidence: 0.96,
      },
    });

    expect(compiled.conversationQuery.date_range).toEqual({
      start: "2026-07-16T05:00:00.000Z",
      end: "2026-07-17T04:59:59.999Z",
      label: "ayer",
    });
    expect(compiled.conversationQuery.movement_filters).toEqual({
      search_terms: [],
      movement_types: [],
      category_ids: [],
      sources: [],
      account_terms: [],
      subcategory_terms: [],
      person_terms: [],
      tag_terms: [],
      uncategorized_only: false,
    });
  });

  it("reanuda una consulta tipada cuando el usuario confirma el turno anterior", () => {
    const pendingQuery = {
      ...fallbackQuery,
      normalized_text: "movimientos del 16 de julio",
      date_range: {
        start: "2026-07-16T00:00:00.000-05:00",
        end: "2026-07-16T23:59:59.999-05:00",
        label: "16 de julio",
      },
      confidence: 0.97,
    };
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: { ...fallbackQuery, kind: "unsupported" },
      workingSet: {
        version: "v1",
        topic: "movement",
        goal: "query",
        last_user_message_summary: "Revisa el 16 de julio",
        last_assistant_result_summary: "Falta confirmar el periodo.",
        last_action: null,
        unresolved_slots: ["Confirmar el periodo"],
        movement_referents: [],
        entity_referents: [],
        active_read_operation: {
          operation_id: "read:test",
          query: pendingQuery,
          selected_tools: ["query_movements"],
          status: "awaiting_clarification",
          missing_slots: ["Confirmar el periodo"],
          created_at: "2026-07-17T09:59:00.000-05:00",
          updated_at: "2026-07-17T09:59:00.000-05:00",
        },
        conversation_style: null,
        updated_at: "2026-07-17T09:59:00.000-05:00",
      },
      plan: {
        ...semanticPlanDefaults,
        goal: "confirmation",
        workflow: "conversation_read_only",
        steps: [],
        conversation_query_kind: null,
        selected_tools: [],
        pending_operation_resolution: "execute",
        response_strategy: "explain",
        requires_confirmation: false,
        risk_flags: ["read_only"],
        confidence: 0.91,
      },
    });

    expect(compiled.route).toBe("conversation_agent");
    expect(compiled.conversationQuery).toEqual(pendingQuery);
    expect(compiled.selectedTools).toEqual(["query_movements"]);
  });

  it("transporta una instruccion de estilo libre sin reducirla a tonos predefinidos", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: { ...fallbackQuery, kind: "unsupported" },
      plan: {
        ...semanticPlanDefaults,
        goal: "help",
        workflow: "support",
        steps: [],
        conversation_query_kind: null,
        selected_tools: [],
        style_update: {
          operation: "set",
          instruction:
            "Explicame con comparaciones cotidianas, frases cortas y sin sonar infantil.",
          response_length: "shorter",
          formality: "casual",
          warmth: "warm",
          playfulness: "inherit",
          directness: "direct",
          emoji_policy: "none",
          scope: "session",
          confidence: 0.94,
        },
        response_strategy: "explain",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.94,
      },
    });

    expect(compiled.styleUpdate).toMatchObject({
      instruction:
        "Explicame con comparaciones cotidianas, frases cortas y sin sonar infantil.",
      scope: "session",
      source: "explicit_user_request",
    });
  });

  it("enruta ayuda y clarificaciones por ConversationAgent aunque no cambien estilo", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: { ...fallbackQuery, kind: "unsupported" },
      plan: {
        ...semanticPlanDefaults,
        goal: "help",
        workflow: "support",
        steps: [],
        conversation_query_kind: null,
        semantic_query: null,
        semantic_turn: {
          ...financialQuestionTurn,
          act: "help",
          experience_mode: "support",
          should_route_to_conversation_agent: false,
          should_ask_clarification_first: true,
        },
        selected_tools: [],
        response_strategy: "clarify",
        requires_confirmation: false,
        risk_flags: ["no_financial_write"],
        confidence: 0.86,
      },
    });

    expect(compiled.route).toBe("conversation_agent");
  });

  it("transporta una resolucion semantica y deja la ejecucion al Core", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: { ...fallbackQuery, kind: "unsupported" },
      plan: {
        ...semanticPlanDefaults,
        goal: "confirmation",
        workflow: "pending_resolution",
        steps: [],
        conversation_query_kind: null,
        financial_resolution: {
          action: "discard",
          target: "pending_item",
          pending_code: "P-ABC12345",
          account_origin_id: null,
          account_destination_id: null,
          category_id: null,
          learn_account_aliases: false,
          confidence: 0.96,
        },
        selected_tools: [],
        response_strategy: "confirm",
        requires_confirmation: false,
        risk_flags: ["core_must_validate_pending_target"],
        confidence: 0.96,
      },
    });

    expect(compiled.financialResolution).toEqual({
      action: "discard",
      target: "pending_item",
      pending_code: "P-ABC12345",
      account_origin_id: null,
      account_destination_id: null,
      category_id: null,
      learn_account_aliases: false,
      confidence: 0.96,
    });
  });

  it("transporta una asignacion de cuentas solo como edicion de Pendiente", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: { ...fallbackQuery, kind: "unsupported" },
      plan: {
        ...semanticPlanDefaults,
        goal: "review",
        workflow: "review_pending",
        steps: [],
        conversation_query_kind: null,
        financial_resolution: {
          action: "assign_transfer",
          target: "pending_item",
          pending_code: "P-ABC12345",
          account_origin_id:
            "11111111-1111-4111-8111-111111111111",
          account_destination_id:
            "22222222-2222-4222-8222-222222222222",
          category_id: null,
          learn_account_aliases: false,
          confidence: 0.94,
        },
        selected_tools: [],
        response_strategy: "confirm",
        requires_confirmation: true,
        risk_flags: ["pending_edit_requires_reconfirmation"],
        confidence: 0.94,
      },
    });

    expect(compiled.financialResolution).toMatchObject({
      action: "assign_transfer",
      target: "pending_item",
      account_origin_id:
        "11111111-1111-4111-8111-111111111111",
      account_destination_id:
        "22222222-2222-4222-8222-222222222222",
    });
    expect(compiled.requiresConfirmation).toBe(true);
  });

  it("rechaza una resolucion financiera semantica de baja confianza", () => {
    const compiled = compileOrchestrationPlan({
      ...compileDefaults,
      fallbackQuery: { ...fallbackQuery, kind: "unsupported" },
      plan: {
        ...semanticPlanDefaults,
        goal: "confirmation",
        workflow: "pending_resolution",
        steps: [],
        conversation_query_kind: null,
        financial_resolution: {
          action: "confirm",
          target: "capture_draft",
          pending_code: null,
          account_origin_id: null,
          account_destination_id: null,
          category_id: null,
          learn_account_aliases: false,
          confidence: 0.42,
        },
        selected_tools: [],
        response_strategy: "clarify",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.62,
      },
    });

    expect(compiled.financialResolution.action).toBe("none");
    expect(compiled.riskFlags).toContain(
      "financial_resolution_rejected_by_compiler",
    );
  });
});
