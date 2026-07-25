import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  rememberConversationOutcome,
  rememberConversationPlanningState,
  rememberConversationTurn,
} from "./conversation-memory";
import { compileOrchestrationPlan } from "@/core/orchestrator/orchestration-plan";
import { upsertConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import type { ConversationContextPack } from "@/agents/conversation-agent";

vi.mock("@/data/repositories/conversation-memory.repository", () => ({
  upsertConversationMemoryState: vi.fn(),
}));

const mockedUpsert = vi.mocked(upsertConversationMemoryState);

describe("conversation working set", () => {
  beforeEach(() => mockedUpsert.mockReset());

  it("recuerda la accion financiera como referente del siguiente turno", async () => {
    mockedUpsert.mockResolvedValue(null);

    await rememberConversationOutcome({
      client: {} as never,
      userId: "user-1",
      channel: "whatsapp",
      intent: "record_movement",
      userMessage: "gaste 20 en desayuno",
      resultSummary: "Listo. Desayuno por S/20.00 registrado.",
      sourceRef: "event-1",
      topic: "movement",
      goal: "capture",
      actionKind: "movement_created",
      actionStatus: "completed",
      movements: [
        {
          id: "movement-1",
          type: "gasto",
          amount: 20,
          currency: "PEN",
          description: "desayuno",
          category_id: "alimentacion",
          occurred_at: "2026-07-16T10:00:00.000Z",
        },
      ],
      now: "2026-07-16T10:00:01.000Z",
    });

    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        referencedMovements: [expect.objectContaining({ id: "movement-1" })],
        metadata: {
          working_set: expect.objectContaining({
            goal: "capture",
            movement_referents: ["movement-1"],
            last_action: expect.objectContaining({
              kind: "movement_created",
              status: "completed",
            }),
          }),
        },
      })
    );
  });

  it("convierte una respuesta read-only en continuidad consultable", async () => {
    mockedUpsert.mockResolvedValue(null);
    const contextPack = context();

    await rememberConversationTurn({
      client: {} as never,
      contextPack,
      answer: {
        response_text: "Encontre un desayuno por S/20.00.",
        answer_kind: "movement_summary",
        confidence: 0.95,
        cited_facts: ["movement_count=1"],
        used_tools: ["query_movements"],
        follow_up_question: null,
        safety_flags: ["read_only"],
      },
      sourceRef: "event-2",
    });

    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          working_set: expect.objectContaining({
            goal: "query",
            movement_referents: ["movement-1"],
            focus_set: expect.objectContaining({
              version: "v1",
              revision: 1,
              subject: "movements",
              ordered_ids: ["movement-1"],
              visible_order: "tool_result_order",
            }),
            last_action: expect.objectContaining({ kind: "query_answered" }),
          }),
        }),
      })
    );
  });

  it("conserva el conjunto exacto, ordenado y trazable de una consulta", async () => {
    mockedUpsert.mockResolvedValue(null);
    const contextPack = context();
    contextPack.query.date_range = {
      start: "2026-06-29T00:00:00.000-05:00",
      end: "2026-07-15T23:59:59.999-05:00",
      label: "movimientos recientes consultados",
    };
    contextPack.query.movement_filters = {
      search_terms: [],
      movement_types: ["gasto"],
      category_ids: ["alimentacion"],
      sources: [],
      account_terms: [],
      uncategorized_only: false,
    };
    contextPack.tool_results[0].data.movements = [
      movementReference("food-1", 20, "Desayuno"),
      movementReference("food-2", 20, "Almuerzo"),
      movementReference("food-3", 8, "Cafe"),
      movementReference("food-4", 10, "Desayuno"),
      movementReference("food-5", 10, "Cafe"),
    ];

    await rememberConversationTurn({
      client: {} as never,
      contextPack,
      answer: {
        response_text: "Son 5 gastos de Alimentacion por S/68.00.",
        answer_kind: "movement_summary",
        confidence: 0.99,
        cited_facts: ["movement_count=5"],
        used_tools: ["query_movements"],
        follow_up_question: null,
        safety_flags: ["read_only"],
      },
      sourceRef: "event-food",
      traceId: "trace-food",
    });

    const input = mockedUpsert.mock.calls[0]?.[1];
    const focusSet = (
      input?.metadata as {
        working_set?: {
          focus_set?: Record<string, unknown>;
        };
      }
    ).working_set?.focus_set;

    expect(focusSet).toMatchObject({
      focus_id: "focus:event-food",
      subject: "movements",
      ordered_ids: ["food-1", "food-2", "food-3", "food-4", "food-5"],
      revision: 1,
      visible_order: "tool_result_order",
      tool_provenance: [
        expect.objectContaining({
          tool_name: "query_movements",
          trace_id: "trace-food",
          source_ref: "event-food",
          result_count: 5,
        }),
      ],
      slot_provenance: expect.arrayContaining([
        expect.objectContaining({
          slot: "date_range",
          source: "explicit_user_message",
        }),
        expect.objectContaining({
          slot: "movement_filters",
          source: "explicit_user_message",
        }),
      ]),
    });
    expect(String(focusSet?.state_hash)).toMatch(/^fnv1a32:/);
    expect(Date.parse(String(focusSet?.expires_at))).toBeGreaterThan(
      Date.parse(contextPack.received_at)
    );
  });

  it("mantiene una preferencia de estilo libre durante la sesion", async () => {
    mockedUpsert.mockResolvedValue(null);
    const turnState = context().turn_state;
    const compiled = compileOrchestrationPlan({
      fallbackQuery: { ...context().query, kind: "unsupported" },
      fallbackTurnState: turnState,
      receivedAt: "2026-07-17T10:00:00.000-05:00",
      plan: {
        goal: "help",
        workflow: "support",
        steps: [],
        conversation_query_kind: null,
        semantic_query: null,
        semantic_turn: turnState,
        selected_tools: [],
        pending_operation_resolution: "none",
        financial_resolution: {
          action: "none",
          target: "none",
          pending_code: null,
          account_origin_id: null,
          account_destination_id: null,
          category_id: null,
          learn_account_aliases: false,
          confidence: 0,
        },
        style_update: {
          operation: "set",
          instruction:
            "Usa ejemplos cotidianos y un ritmo tranquilo, pero ve directo al punto.",
          response_length: "balanced",
          formality: "casual",
          warmth: "warm",
          playfulness: "inherit",
          directness: "direct",
          emoji_policy: "none",
          scope: "session",
          confidence: 0.96,
        },
        response_strategy: "explain",
        requires_confirmation: false,
        risk_flags: [],
        confidence: 0.96,
      },
    });

    await rememberConversationPlanningState({
      client: {} as never,
      userId: "user-1",
      channel: "whatsapp",
      userMessage: "Quiero que uses ejemplos cotidianos y vayas al punto",
      sourceRef: "event-style",
      compiled,
      previousState: null,
      now: "2026-07-17T10:00:00.000-05:00",
    });

    expect(mockedUpsert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          working_set: expect.objectContaining({
            conversation_style: expect.objectContaining({
              instruction:
                "Usa ejemplos cotidianos y un ritmo tranquilo, pero ve directo al punto.",
              scope: "session",
              source: "explicit_user_request",
            }),
          }),
        }),
      })
    );
  });
});

function context(): ConversationContextPack {
  return {
    context_pack_type: "conversation_context",
    version: "v1",
    user_id: "user-1",
    locale: "es-PE",
    timezone: "America/Lima",
    channel: "whatsapp",
    original_message: "que gaste hoy",
    received_at: "2026-07-16T10:00:00.000Z",
    query: {
      kind: "movement_search",
      normalized_text: "que gaste hoy",
      requested_amount: null,
      date_range: null,
      confidence: 0.9,
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
    active_conversation_state: {
      state_id: null,
      last_intent: null,
      last_query_kind: null,
      last_query_text: null,
      last_query_date_range: null,
      last_result_summary: null,
      referenced_movements: [],
      referenced_entities: [],
      continuity_hint: null,
      expires_at: null,
      working_set: null,
    },
    preferences_summary: {
      tone_style: null,
      conversation_style: null,
      discreet_mode: false,
      whatsapp_opt_in: false,
      email_opt_in: false,
      quiet_hours: null,
      default_account_id: null,
    },
    memory_summary: { frequent_people: [], recent_corrections: [] },
    permissions: { read_only: true, can_mutate_financial_data: false },
    tool_results: [
      {
        tool_name: "query_movements",
        status: "called",
        facts: ["movement_count=1"],
        warnings: [],
        data: {
          movements: [
            {
              id: "movement-1",
              type: "gasto",
              amount: 20,
              currency: "PEN",
              description: "desayuno",
              category_id: "alimentacion",
              occurred_at: "2026-07-16T10:00:00.000Z",
            },
          ],
        },
      },
    ],
    data_limits: [],
  };
}

function movementReference(id: string, amount: number, description: string) {
  return {
    id,
    type: "gasto",
    amount,
    currency: "PEN",
    description,
    category_id: "alimentacion",
    occurred_at: "2026-07-14T10:00:00.000-05:00",
  };
}
