import { describe, expect, it } from "vitest";
import {
  buildSafePlanningContext,
} from "@/agents/orchestration-planning-agent";
import type { DataContextPack } from "@/agents/data-agent";
import type {
  ConversationContextPack,
  ConversationQuery,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";
import { ConversationalExecutiveAgent } from "./conversational-executive-agent";
import { compileExecutiveEvidenceAndPolicy } from "./evidence-and-policy-compiler";
import { LocalFixtureConversationalExecutiveAgentRuntime } from "./local-fixture-runtime";
import type { ConversationalExecutiveContextPack } from "./types";
import { buildTurnWorkspace } from "@/core/conversation/turn-workspace";

const query: ConversationQuery = {
  kind: "movement_search",
  normalized_text: "cuanto gaste en alimentacion normalmente",
  requested_amount: null,
  date_range: null,
  movement_filters: {
    search_terms: [],
    movement_types: ["gasto"],
    category_ids: ["alimentacion"],
    sources: [],
    account_terms: [],
    subcategory_terms: [],
    person_terms: [],
    tag_terms: [],
    uncategorized_only: false,
  },
  confidence: 0.97,
};

const turnState: ConversationTurnState = {
  act: "financial_question",
  continuity: "new_topic",
  emotional_state: "curious",
  experience_mode: "read_only_answer",
  should_use_active_memory: false,
  should_route_to_conversation_agent: true,
  should_ask_clarification_first: false,
  response_guidance: ["responder con evidencia confirmada"],
  personalization_cues: [],
  risk_notes: ["consulta read-only"],
};

describe("ConversationalExecutiveAgent", () => {
  it("resuelve un turno completo con modulos tipados y una sola autoridad", async () => {
    const agent = new ConversationalExecutiveAgent();
    const result = await agent.run(
      contextPack(),
      "trace-executive",
      async (toolName) => {
        expect(toolName).toBe("query_movements");
        return {
          tool_name: "query_movements",
          status: "called",
          facts: [
            "movement_count=5",
            "date_label=movimientos recientes",
            "net_amount=S/ -68.00",
          ],
          warnings: [],
          data: {
            date_label: "movimientos recientes",
            reference_source: null,
            net_amount: -68,
            movements: [
              movement("food-1", 20, "Desayuno", "2026-07-15T09:00:00-05:00"),
              movement("food-2", 20, "Almuerzo", "2026-07-14T13:00:00-05:00"),
              movement("food-3", 8, "Cafe", "2026-07-14T16:00:00-05:00"),
              movement("food-4", 10, "Desayuno", "2026-07-14T08:00:00-05:00"),
              movement("food-5", 10, "Cafe", "2026-06-29T17:00:00-05:00"),
            ],
          },
        };
      }
    );

    expect(result.output.turn_interpretation).toMatchObject({
      goal: "query",
      workflow: "conversation_read_only",
      semantic_query: expect.objectContaining({
        kind: "movement_search",
      }),
    });
    expect(result.output.tool_requests).toEqual([
      expect.objectContaining({ tool_name: "query_movements" }),
    ]);
    expect(result.output.financial_proposals.result).toEqual([]);
    expect(result.output.correction_proposal.is_correction).toBe(false);
    expect(result.output.response_composition).toMatchObject({
      answer_kind: "movement_summary",
      used_tools: ["query_movements"],
    });
    expect(result.output.response_composition.response_text).toContain(
      "5 movimientos"
    );
    expect(result.output.response_composition.grounded_claims).not.toHaveLength(
      0,
    );
    expect(result.output.response_composition.composition_stage).toBe(
      "final_read_only",
    );
    expect(result.runtime.provider).toBe("local_fixture");
    expect(result.safety.policy_flags).toContain(
      "single_semantic_turn_authority"
    );
    expect(result.tool_results).toHaveLength(1);
    expect(
      compileExecutiveEvidenceAndPolicy({
        contextPack: contextPack(),
        output: result.output,
        toolResults: result.tool_results,
      }).accepted,
    ).toBe(true);
  });

  it("regenera una sola vez con feedback tipado cuando falla el grounding", async () => {
    const local = new LocalFixtureConversationalExecutiveAgentRuntime();
    let calls = 0;
    const runtime: AgentRuntime = {
      async run<TContext, TOutput>(
        request: AgentRuntimeRequest<TContext>,
      ): Promise<AgentRuntimeResponse<TOutput>> {
        calls += 1;
        if (calls === 2) {
          expect(
            (
              request.context_pack as ConversationalExecutiveContextPack
            ).validation_feedback,
          ).toMatchObject({
            attempt: 2,
            issue_codes: ["claim_without_known_evidence"],
          });
        }
        const result = await local.run<TContext, TOutput>(request);
        if (calls === 1) {
          const output = structuredClone(
            result.output,
          ) as TOutput & {
            response_composition: {
              grounded_claims: Array<{ evidence_refs: string[] }>;
            };
          };
          output.response_composition.grounded_claims[0]!.evidence_refs = [
            "tool:invented:fact:0",
          ];
          return { ...result, output };
        }
        return result;
      },
    };
    const agent = new ConversationalExecutiveAgent(runtime);

    const result = await agent.run(
      contextPack(),
      "trace-regeneration",
      async () => ({
        tool_name: "query_movements",
        status: "called",
        facts: ["movement_count=5"],
        warnings: [],
        data: { movements: [] },
      }),
    );

    expect(calls).toBe(2);
    expect(result.safety.policy_flags).toContain(
      "structured_regeneration_applied",
    );
    expect(result.tool_calls).toHaveLength(2);
  });

  it("extrae una captura simple sin invocar otro agente semantico", async () => {
    const agent = new ConversationalExecutiveAgent();
    const result = await agent.run(
      contextForTurn({
        message: "gaste 20 soles en desayuno",
        act: "financial_capture",
      }),
      "trace-capture-simple",
      noToolExpected,
    );

    expect(result.output.financial_proposals).toMatchObject({
      intent: "record_movement",
      result: [
        expect.objectContaining({
          amount: 20,
          movement_type: "gasto",
          category_id: "alimentacion",
        }),
      ],
    });
    expect(result.output.response_composition.composition_stage).toBe(
      "pre_core_draft",
    );
  });

  it("mantiene una nueva deuda en el contrato especializado y no la degrada a movimiento generico", async () => {
    const result = await new ConversationalExecutiveAgent().run(
      contextForTurn({
        message:
          "Juan me presto 100 soles, le voy a pagar en 5 cuotas",
        act: "financial_capture",
      }),
      "trace-executive-debt-creation",
      noToolExpected,
    );

    expect(result.output.financial_proposals).toMatchObject({
      intent: "record_movement",
      requires_confirmation: true,
      result: [
        {
          movement_type: "prestamo_recibido",
          amount: 100,
          account_destination_id: null,
          debt_hint: {
            operation: "create_debt",
            direction: "i_owe",
            person_name: "Juan",
            installment_count: 5,
            first_due_date: null,
          },
        },
      ],
      ambiguities: [
        {
          field: "first_due_date",
          action_id: "action_1",
        },
      ],
    });
    expect(result.output.response_composition.composition_stage).toBe(
      "pre_core_draft",
    );
    expect(result.safety.policy_flags).toContain(
      "single_semantic_turn_authority",
    );
  });

  it("conserva todas las acciones de una captura multiple", async () => {
    const result = await new ConversationalExecutiveAgent().run(
      contextForTurn({
        message: "gaste 20 en desayuno y 8 en cafe",
        act: "financial_capture",
      }),
      "trace-capture-multiple",
      noToolExpected,
    );

    expect(result.output.financial_proposals.intent).toBe(
      "record_multiple_movements",
    );
    expect(result.output.financial_proposals.result).toHaveLength(2);
    expect(
      result.output.financial_proposals.result.map((action) => action.amount),
    ).toEqual([20, 8]);
  });

  it("propone una correccion acotada y exige confirmacion", async () => {
    const correctionContext = contextForTurn({
      message: "cambia el taxi a transporte",
      act: "correction",
      recentMovements: [
        dataMovement(
          "00000000-0000-4000-8000-000000000015",
          15,
          "Taxi",
          "2026-07-14T15:00:00-05:00",
        ),
      ],
    });
    correctionContext.data_context.recent_movements[0]!.category_id =
      "alimentacion";

    const result = await new ConversationalExecutiveAgent().run(
      correctionContext,
      "trace-correction",
      noToolExpected,
    );

    expect(result.output.correction_proposal).toMatchObject({
      is_correction: true,
      candidate_movement_ids: [
        "00000000-0000-4000-8000-000000000015",
      ],
      requires_confirmation: true,
    });
    expect(result.output.response_composition.composition_stage).toBe(
      "pre_core_draft",
    );
  });

  it("mantiene captura y consulta en el mismo turno tipado", async () => {
    const result = await new ConversationalExecutiveAgent().run(
      contextForTurn({
        message: "gaste 20 en desayuno, como voy esta semana?",
        act: "financial_capture",
        queryOverride: {
          ...query,
          normalized_text: "como voy esta semana",
          date_range: {
            start: "2026-07-20T00:00:00-05:00",
            end: "2026-07-26T23:59:59-05:00",
            label: "esta semana",
          },
          movement_filters: null,
        },
      }),
      "trace-mixed",
      async () => ({
        tool_name: "query_movements",
        status: "called",
        facts: ["movement_count=2", "net_amount=S/ -28.00"],
        warnings: [],
        data: { movements: [] },
      }),
    );

    expect(result.output.orchestration_plan).toMatchObject({
      goal: "mixed",
      workflow: "mixed_capture_and_query",
    });
    expect(result.output.financial_proposals.result).toHaveLength(1);
    expect(result.output.response_composition.used_tools).toContain(
      "query_movements",
    );
    expect(result.output.response_composition.composition_stage).toBe(
      "pre_core_draft",
    );
  });
});

async function noToolExpected(): Promise<never> {
  throw new Error("No se esperaba una tool para este turno.");
}

function contextForTurn(input: {
  message: string;
  act: ConversationTurnState["act"];
  queryOverride?: ConversationQuery;
  recentMovements?: DataContextPack["recent_movements"];
}): ConversationalExecutiveContextPack {
  const pack = contextPack();
  const nextQuery = input.queryOverride ?? {
    ...query,
    kind: "unsupported" as const,
    normalized_text: input.message,
    date_range: null,
    movement_filters: null,
  };
  const nextTurnState: ConversationTurnState = {
    ...turnState,
    act: input.act,
    experience_mode:
      input.act === "financial_capture"
        ? "quick_capture"
        : input.act === "correction"
          ? "correction"
          : turnState.experience_mode,
    should_route_to_conversation_agent:
      input.act !== "financial_capture" && input.act !== "correction",
  };
  pack.planning_context.original_message = input.message;
  pack.planning_context.kernel_hint.query = nextQuery;
  pack.planning_context.kernel_hint.turn_state = nextTurnState;
  pack.data_context.original_message = input.message;
  pack.data_context.recent_movements = input.recentMovements ?? [];
  pack.conversation_context.original_message = input.message;
  pack.conversation_context.query = nextQuery;
  pack.conversation_context.turn_state = nextTurnState;
  pack.turn_workspace = buildTurnWorkspace({
    turnId: `fixture:${input.act}`,
    planningContext: pack.planning_context,
    dataContext: pack.data_context,
    conversationContext: pack.conversation_context,
  });
  return pack;
}

function contextPack(): ConversationalExecutiveContextPack {
  const planningContext = buildSafePlanningContext({
    userId: "00000000-0000-4000-8000-000000000001",
    timezone: "America/Lima",
    channel: "whatsapp",
    originalMessage: "cuanto gaste en alimentacion normalmente?",
    receivedAt: "2026-07-24T10:00:00.000-05:00",
    query,
    turnState,
  });
  const conversationContext: ConversationContextPack = {
    context_pack_type: "conversation_context",
    version: "v1",
    user_id: planningContext.user_id,
    locale: "es-PE",
    timezone: planningContext.timezone,
    channel: "whatsapp",
    original_message: planningContext.original_message,
    received_at: planningContext.received_at,
    query,
    turn_state: turnState,
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
      whatsapp_opt_in: true,
      email_opt_in: false,
      quiet_hours: null,
      default_account_id: null,
    },
    memory_summary: {
      frequent_people: [],
      recent_corrections: [],
    },
    permissions: {
      read_only: true,
      can_mutate_financial_data: false,
    },
    tool_results: [],
    data_limits: [],
  };
  const dataContext: DataContextPack = {
    context_pack_type: "data_context",
    version: "v2",
    user_id: planningContext.user_id,
    locale: "es-PE",
    timezone: planningContext.timezone,
    channel: "whatsapp",
    discreet_mode: false,
    preferences_summary: {},
    risk_context: {},
    original_message: planningContext.original_message,
    received_at: planningContext.received_at,
    categories: [
      {
        id: "alimentacion",
        label: "Alimentacion",
        is_sensitive: false,
      },
    ],
    accounts: [],
    boxes: [],
    subcategories: [],
    tags: [],
    related_people: [],
    active_debts: [],
    recent_movements: [],
    recent_corrections: [],
    learned_vocabulary: [],
    active_capture_draft: null,
  };

  return {
    context_pack_type: "conversational_executive_context",
    version: "v1",
    planning_context: planningContext,
    data_context: dataContext,
    conversation_context: conversationContext,
    turn_workspace: buildTurnWorkspace({
      turnId: "trace-executive",
      planningContext,
      dataContext,
      conversationContext,
    }),
    constraints: [
      "La IA propone.",
      "El dominio valida.",
      "El Core ejecuta.",
    ],
  };
}

function movement(
  id: string,
  amount: number,
  description: string,
  occurredAt: string
) {
  return {
    id,
    type: "gasto",
    amount,
    currency: "PEN",
    description,
    merchant: description,
    category_id: "alimentacion",
    category_label: "Alimentacion",
    occurred_at: occurredAt,
    source: "whatsapp",
  };
}

function dataMovement(
  id: string,
  amount: number,
  description: string,
  occurredAt: string,
): DataContextPack["recent_movements"][number] {
  return {
    id,
    type: "gasto",
    amount,
    currency: "PEN",
    description,
    merchant: description,
    category_id: "alimentacion",
    subcategory_id: null,
    related_person_id: null,
    occurred_at: occurredAt,
    account_origin_id: null,
    account_destination_id: null,
    status: "confirmed",
    source: "whatsapp",
  };
}
