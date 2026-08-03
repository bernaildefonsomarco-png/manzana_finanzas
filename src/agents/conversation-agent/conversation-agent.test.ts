import { describe, expect, it } from "vitest";
import {
  ConversationAgent,
  validateConversationGrounding,
} from "./conversation-agent";
import { composeConversationAnswer } from "./local-fixture-runtime";
import type {
  ConversationalAnswer,
  ConversationContextPack,
} from "./types";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";

function contextPack(
  overrides: Partial<ConversationContextPack> = {}
): ConversationContextPack {
  return {
    context_pack_type: "conversation_context",
    version: "v1",
    user_id: "00000000-0000-4000-8000-000000000001",
    locale: "es-PE",
    timezone: "America/Lima",
    original_message: "puedo gastar 50 hoy?",
    received_at: "2026-07-15T12:00:00.000Z",
    query: {
      kind: "balance_snapshot",
      normalized_text: "puedo gastar 50 hoy",
      requested_amount: 50,
      date_range: null,
      confidence: 0.86,
    },
    turn_state: {
      act: "financial_question",
      continuity: "new_topic",
      emotional_state: "neutral",
      experience_mode: "read_only_answer",
      should_use_active_memory: false,
      should_route_to_conversation_agent: true,
      should_ask_clarification_first: false,
      response_guidance: [
        "responder sin culpa",
        "no inventar datos",
        "mantener read-only salvo que el flujo pase por Core",
      ],
      personalization_cues: ["personalizacion ligera"],
      risk_notes: ["consulta read-only"],
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
    memory_summary: {
      frequent_people: [],
      recent_corrections: [],
    },
    permissions: {
      read_only: true,
      can_mutate_financial_data: false,
    },
    tool_results: [
      {
        tool_name: "get_balance_snapshot",
        status: "called",
        facts: [
          "total_balance=S/800.00",
          "operational_free_money=S/220.00",
        ],
        warnings: [],
        data: {
          total_balance: 800,
          separated_in_boxes: 400,
          free_in_accounts: 300,
          upcoming_uncovered_commitments: 80,
          operational_free_money: 220,
          has_accounts: true,
        },
      },
    ],
    data_limits: [
      "Solo se usan datos confirmados para saldos y movimientos.",
    ],
    ...overrides,
  };
}

describe("ConversationAgent", () => {
  it("rechaza promesas de trabajo futuro cuando la consulta ya fue ejecutada", () => {
    const issues = validateConversationGrounding(
      contextPack({
        query: {
          kind: "movement_search",
          normalized_text: "ayer tuve movimientos",
          requested_amount: null,
          date_range: {
            start: "2026-07-16T00:00:00.000-05:00",
            end: "2026-07-16T23:59:59.999-05:00",
            label: "ayer",
          },
          confidence: 0.95,
        },
        tool_results: [
          {
            tool_name: "query_movements",
            status: "called",
            facts: ["movement_count=0", "date_label=ayer"],
            warnings: [],
            data: { movements: [], movement_count: 0, date_label: "ayer" },
          },
        ],
      }),
      {
        response_text:
          "Perfecto. Volvere a consultar; por ahora no puedo confirmar si hubo movimientos.",
        answer_kind: "movement_summary",
        confidence: 0.7,
        cited_facts: [],
        used_tools: [],
        follow_up_question: null,
        safety_flags: ["read_only"],
      }
    );

    expect(issues).toContain(
      "La respuesta promete trabajo futuro que no existe en este turno."
    );
    expect(issues).toContain(
      "La respuesta niega una consulta de movimientos que ya fue ejecutada."
    );
  });

  it("acepta una respuesta actual sustentada en la herramienta ejecutada", () => {
    const issues = validateConversationGrounding(contextPack(), {
      response_text:
        "Con los datos confirmados, tienes S/220.00 de dinero libre.",
      answer_kind: "balance_snapshot",
      confidence: 0.94,
      cited_facts: ["operational_free_money=S/220.00"],
      used_tools: ["get_balance_snapshot"],
      follow_up_question: null,
      safety_flags: ["read_only"],
    });

    expect(issues).toEqual([]);
  });

  it("responde sobre dinero libre sin convertir el saldo actual en un veredicto de cierre", () => {
    const answer = composeConversationAnswer(contextPack());

    expect(answer.answer_kind).toBe("balance_snapshot");
    expect(answer.response_text).toContain("S/220.00");
    expect(answer.response_text).toContain("S/50.00");
    expect(answer.response_text).toContain("S/170.00");
    expect(answer.response_text).toContain(
      "Para calcular como quedaria el cierre del mes necesito tambien tu ritmo de gasto",
    );
    expect(answer.response_text).not.toMatch(
      /si puedes|no te lo recomendaria|no te alcanza|deberias/i,
    );
    expect(answer.used_tools).toEqual(["get_balance_snapshot"]);
    expect(answer.safety_flags).toContain("read_only");
    expect(answer.safety_flags).toContain("no_financial_write");
  });

  it("responde busquedas historicas con movimientos confirmados y fuente", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "que gaste el ultimo viernes de hace 4 meses",
        query: {
          kind: "movement_search",
          normalized_text: "que gaste el ultimo viernes de hace 4 meses",
          requested_amount: null,
          date_range: {
            start: "2026-03-13T00:00:00.000-05:00",
            end: "2026-03-13T23:59:59.999-05:00",
            label: "el ultimo viernes de hace 4 meses",
          },
          confidence: 0.84,
        },
        tool_results: [
          {
            tool_name: "query_movements",
            status: "called",
            facts: [
              "movement_count=2",
              "date_label=el ultimo viernes de hace 4 meses",
            ],
            warnings: [],
            data: {
              date_label: "el ultimo viernes de hace 4 meses",
              movements: [
                {
                  type: "gasto",
                  amount: 15,
                  currency: "PEN",
                  description: "taxi",
                  category_id: "transporte",
                  category_label: "Transporte",
                  occurred_at: "2026-03-13T14:00:00.000-05:00",
                  source: "whatsapp",
                },
                {
                  type: "gasto",
                  amount: 20,
                  currency: "PEN",
                  description: "almuerzo",
                  category_id: "alimentacion",
                  category_label: "Alimentacion",
                  occurred_at: "2026-03-13T18:00:00.000-05:00",
                  source: "whatsapp",
                },
              ],
            },
          },
        ],
      })
    );

    expect(answer.answer_kind).toBe("movement_summary");
    expect(answer.response_text).toContain("Taxi");
    expect(answer.response_text).toContain("Almuerzo");
    expect(answer.response_text).toContain("Neto");
    expect(answer.used_tools).toEqual(["query_movements"]);
  });

  it("incluye horas cuando el usuario pregunta por la hora de cada movimiento", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "me puedes decir la hora de cada uno?",
        query: {
          kind: "movement_search",
          normalized_text: "me puedes decir la hora de cada uno",
          requested_amount: null,
          date_range: null,
          confidence: 0.75,
        },
        tool_results: [
          {
            tool_name: "query_movements",
            status: "called",
            facts: ["movement_count=2", "date_label=sin rango explicito"],
            warnings: [
              "La consulta no tenia fecha explicita; se muestran movimientos recientes.",
            ],
            data: {
              date_label: "movimientos recientes",
              movements: [
                {
                  type: "gasto",
                  amount: 8,
                  currency: "PEN",
                  description: "cafe",
                  category_id: "alimentacion",
                  occurred_at: "2026-07-15T09:30:00.000-05:00",
                },
                {
                  type: "gasto",
                  amount: 15,
                  currency: "PEN",
                  description: "taxi",
                  category_id: "transporte",
                  occurred_at: "2026-07-15T11:15:00.000-05:00",
                },
              ],
            },
          },
        ],
      })
    );

    expect(answer.answer_kind).toBe("movement_summary");
    expect(answer.response_text).toContain("hora");
    expect(answer.response_text).toContain("09:30");
    expect(answer.response_text).toContain("11:15");
    expect(answer.used_tools).toEqual(["query_movements"]);
  });

  it("responde seguimientos por cuenta, categoria y origen sin inventar", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "el primero en que cuenta fue y de donde salio?",
        query: {
          kind: "movement_search",
          normalized_text: "el primero en que cuenta fue y de donde salio",
          requested_amount: null,
          date_range: {
            start: "2026-07-15T00:00:00.000-05:00",
            end: "2026-07-15T23:59:59.999-05:00",
            label: "hoy",
          },
          confidence: 0.88,
        },
        active_conversation_state: {
          state_id: "state-1",
          last_intent: "movement_search",
          last_query_kind: "movement_search",
          last_query_text: "que movimientos hice hoy",
          last_query_date_range: {
            start: "2026-07-15T00:00:00.000-05:00",
            end: "2026-07-15T23:59:59.999-05:00",
            label: "hoy",
          },
          last_result_summary: "Encontre 2 movimientos confirmados para hoy.",
          referenced_movements: [],
          referenced_entities: [],
          continuity_hint: "El usuario puede referirse a 2 movimientos de hoy.",
          expires_at: "2026-07-15T13:00:00.000Z",
          working_set: null,
        },
        tool_results: [
          {
            tool_name: "query_movements",
            status: "called",
            facts: [
              "movement_count=1",
              "date_label=referencia conversacional activa",
            ],
            warnings: [],
            data: {
              date_label: "hoy",
              reference_source: "active_conversation_state",
              movements: [
                {
                  type: "gasto",
                  amount: 15,
                  currency: "PEN",
                  description: "taxi",
                  category_id: "transporte",
                  category_label: "Transporte",
                  occurred_at: "2026-07-15T11:15:00.000-05:00",
                  source: "whatsapp",
                  account_origin_id: "account-1",
                  account_origin_name: "Efectivo",
                },
              ],
            },
          },
        ],
      })
    );

    expect(answer.answer_kind).toBe("movement_summary");
    expect(answer.response_text).toContain("respuesta anterior");
    expect(answer.response_text).toContain("cuenta Efectivo");
    expect(answer.response_text).toContain("origen WhatsApp");
    expect(answer.response_text).not.toContain("Neto del periodo");
  });

  it("responde deudas separando lo que debo y lo que me deben", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "cuanto le debo a Luis?",
        query: {
          kind: "debt_summary",
          normalized_text: "cuanto le debo a luis",
          requested_amount: null,
          date_range: null,
          confidence: 0.84,
        },
        tool_results: [
          {
            tool_name: "get_debt_summary",
            status: "called",
            facts: [
              "debt_count=2",
              "i_owe_total=S/120.00",
              "they_owe_me_total=S/40.00",
            ],
            warnings: [],
            data: {
              date_label: "proximos 31 dias",
              totals: {
                i_owe_total: 120,
                they_owe_me_total: 40,
                i_owe_count: 1,
                they_owe_me_count: 1,
              },
              debts: [
                {
                  id: "debt-1",
                  name: "Prestamo",
                  person_name: "Luis",
                  direction: "i_owe",
                  amount: 120,
                  currency: "PEN",
                  status: "active",
                  due_date: "2026-07-28",
                },
                {
                  id: "debt-2",
                  name: "Cena",
                  person_name: "Ana",
                  direction: "they_owe_me",
                  amount: 40,
                  currency: "PEN",
                  status: "active",
                },
              ],
              installments: [],
            },
          },
        ],
      })
    );

    expect(answer.answer_kind).toBe("debt_summary");
    expect(answer.response_text).toContain("Por pagar: S/120.00");
    expect(answer.response_text).toContain("Por cobrar: S/40.00");
    expect(answer.response_text).toContain("Debes a Luis");
    expect(answer.used_tools).toEqual(["get_debt_summary"]);
    expect(answer.safety_flags).toContain("read_only");
  });

  it("usa las filas individuales de cuotas y separa saldo de calendario", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "cuales son las cuotas de la deuda de Juana",
        query: {
          kind: "debt_summary",
          normalized_text: "cuales son las cuotas de la deuda de juana",
          requested_amount: null,
          date_range: null,
          confidence: 0.95,
        },
        tool_results: [
          {
            tool_name: "get_debt_summary",
            status: "called",
            facts: ["debt_count=1", "i_owe_total=S/55.00"],
            warnings: [],
            data: {
              debts: [
                {
                  id: "debt-juana",
                  person_name: "Juana",
                  amount: 55,
                  currency: "PEN",
                  direction: "i_owe",
                  status: "active",
                },
              ],
              totals: {
                i_owe_total: 55,
                they_owe_me_total: 0,
                i_owe_count: 1,
                they_owe_me_count: 0,
              },
            },
          },
          {
            tool_name: "get_debt_details",
            status: "called",
            facts: ["debt_count=1", "installment_count=2"],
            warnings: [
              "Juana: la cantidad configurada de cuotas (5) no coincide con las filas del calendario (2); las filas individuales tienen prioridad.",
            ],
            data: {
              details: [
                {
                  id: "debt-juana",
                  person_name: "Juana",
                  currency: "PEN",
                  current_balance: 55,
                  schedule: {
                    installment_count: 2,
                    configured_installment_count: 5,
                    configured_installment_amount: 20,
                    expected_total: 55,
                    paid_total: 0,
                    remaining_total: 55,
                    balance_gap: 0,
                  },
                  installments: [
                    {
                      number: 1,
                      due_date: "2026-07-30",
                      expected_amount: 20,
                      paid_amount: 0,
                      remaining_amount: 20,
                      status: "pending",
                    },
                    {
                      number: 2,
                      due_date: "2026-08-30",
                      expected_amount: 35,
                      paid_amount: 0,
                      remaining_amount: 35,
                      status: "pending",
                    },
                  ],
                },
              ],
            },
          },
        ],
      })
    );

    expect(answer.response_text).toContain("Cuota 1");
    expect(answer.response_text).toContain("Cuota 2");
    expect(answer.response_text).toContain("S/20.00");
    expect(answer.response_text).toContain("S/35.00");
    expect(answer.response_text).toContain("restante programado S/55.00");
    expect(answer.response_text).toContain("cantidad configurada de cuotas");
    expect(answer.response_text).not.toContain("5 cuotas de S/20.00");
    expect(answer.used_tools).toEqual([
      "get_debt_summary",
      "get_debt_details",
    ]);
  });

  it("responde pagos que vienen anticipando compromisos sin marcarlos como pagados", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "que pagos vienen este mes?",
        query: {
          kind: "recurring_summary",
          normalized_text: "que pagos vienen este mes",
          requested_amount: null,
          date_range: {
            start: "2026-07-01T00:00:00.000-05:00",
            end: "2026-07-31T23:59:59.999-05:00",
            label: "este mes",
          },
          confidence: 0.84,
        },
        tool_results: [
          {
            tool_name: "get_recurring_summary",
            status: "called",
            facts: [
              "recurring_rule_count=1",
              "upcoming_recurring_count=1",
              "upcoming_total=S/35.00",
            ],
            warnings: [],
            data: {
              date_label: "este mes",
              total_amount: 35,
              commitments: [
                {
                  id: "rec-1",
                  title: "Netflix",
                  amount: 35,
                  currency: "PEN",
                  due_at: "2026-07-20",
                  kind: "recurring",
                },
              ],
              rules: [],
              suggested_count: 0,
            },
          },
        ],
      })
    );

    expect(answer.answer_kind).toBe("recurring_summary");
    expect(answer.response_text).toContain("Netflix");
    expect(answer.response_text).toContain("Total aproximado: S/35.00");
    expect(answer.response_text).not.toContain("pagado");
    expect(answer.used_tools).toEqual(["get_recurring_summary"]);
  });

  it("responde memoria financiera con preferencias y contexto resumido", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "que recuerdas de mis preferencias?",
        query: {
          kind: "financial_memory_search",
          normalized_text: "que recuerdas de mis preferencias",
          requested_amount: null,
          date_range: null,
          confidence: 0.78,
        },
        tool_results: [
          {
            tool_name: "search_financial_memory",
            status: "called",
            facts: [
              "frequent_people_count=2",
              "recent_corrections_count=1",
              "has_active_conversation=true",
            ],
            warnings: [],
            data: {
              requested_facets: [
                "preferences",
                "people",
                "active_conversation",
              ],
              preferences: {
                tone_style: "breve",
                discreet_mode: true,
              },
              frequent_people: [
                {
                  id: "person-1",
                  display_name: "Luis",
                  kind: "friend",
                  relationship_label: "amigo",
                  aliases: ["Lucho"],
                  last_seen_at: "2026-07-15T10:00:00.000Z",
                },
                {
                  id: "person-2",
                  display_name: "Ana",
                  kind: "friend",
                  relationship_label: null,
                  aliases: [],
                  last_seen_at: "2026-07-14T10:00:00.000Z",
                },
              ],
              matched_people: [],
              recent_corrections: [
                {
                  action: "corrected",
                  field_name: "category_id",
                  created_at: "2026-07-15T10:00:00.000Z",
                  movement_id: "movement-1",
                  summary: "Corrigio categoria",
                },
              ],
              matched_corrections: [],
              active_conversation: {
                last_query_kind: "movement_search",
                last_query_text: "que movimientos hice hoy",
                last_result_summary: "Encontre 3 movimientos.",
                referenced_movements_count: 3,
                referenced_entities: [],
                continuity_hint:
                  "El usuario puede referirse a 3 movimientos de hoy.",
              },
            },
          },
        ],
      })
    );

    expect(answer.answer_kind).toBe("memory_summary");
    expect(answer.response_text).toContain("modo discreto activo");
    expect(answer.response_text).toContain("Luis - amigo");
    expect(answer.response_text).toContain("Ana - friend");
    expect(answer.response_text).toContain("hilo actual");
    expect(answer.used_tools).toEqual(["search_financial_memory"]);
    expect(answer.safety_flags).toContain("no_raw_history");
  });

  it("responde preguntas amplias de memoria sin inventar patrones profundos", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "que sabes de mi forma de gastar?",
        query: {
          kind: "financial_memory_search",
          normalized_text: "que sabes de mi forma de gastar",
          requested_amount: null,
          date_range: null,
          confidence: 0.78,
        },
        tool_results: [
          {
            tool_name: "search_financial_memory",
            status: "called",
            facts: [
              "requested_facets=narrative,preferences,people,patterns",
              "matched_people_count=1",
              "has_preferences=true",
            ],
            warnings: [
              "La memoria semantica/narrativa profunda todavia esta limitada; se responde con preferencias, personas, correcciones y contexto activo.",
            ],
            data: {
              requested_facets: ["narrative", "preferences", "people", "patterns"],
              memory_levels_limited: ["narrative", "patterns"],
              preferences: {
                tone_style: "breve",
                discreet_mode: false,
                whatsapp_opt_in: true,
              },
              frequent_people: [
                {
                  id: "person-1",
                  display_name: "Luis",
                  kind: "friend",
                  relationship_label: "amigo",
                  aliases: [],
                  last_seen_at: "2026-07-15T10:00:00.000Z",
                },
              ],
              matched_people: [
                {
                  id: "person-1",
                  display_name: "Luis",
                  kind: "friend",
                  relationship_label: "amigo",
                  aliases: [],
                  last_seen_at: "2026-07-15T10:00:00.000Z",
                },
              ],
              recent_corrections: [],
              matched_corrections: [],
              active_conversation: null,
            },
          },
        ],
      })
    );

    expect(answer.answer_kind).toBe("memory_summary");
    expect(answer.response_text).toContain("estilo de respuesta");
    expect(answer.response_text).toContain("Luis - amigo");
    expect(answer.response_text).toContain("no invento una lectura profunda");
    expect(answer.safety_flags).toContain("no_raw_history");
  });

  it("usa el estado conversacional para responder seguimientos sin reiniciar el hilo", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message: "me puedes decir la hora de cada uno?",
        query: {
          kind: "movement_search",
          normalized_text: "me puedes decir la hora de cada uno",
          requested_amount: null,
          date_range: null,
          confidence: 0.88,
        },
        turn_state: {
          act: "financial_follow_up",
          continuity: "follow_up",
          emotional_state: "neutral",
          experience_mode: "read_only_answer",
          should_use_active_memory: true,
          should_route_to_conversation_agent: true,
          should_ask_clarification_first: false,
          response_guidance: [
            "usar la respuesta anterior como contexto activo",
            "no explicar desde cero si el seguimiento es claro",
          ],
          personalization_cues: [
            "hay memoria conversacional activa",
            "continuar el hilo anterior sin repetir introducciones",
          ],
          risk_notes: ["consulta read-only"],
        },
        tool_results: [
          {
            tool_name: "query_movements",
            status: "called",
            facts: [
              "movement_count=1",
              "date_label=referencia conversacional activa",
            ],
            warnings: [],
            data: {
              date_label: "la respuesta anterior",
              reference_source: "active_conversation_state",
              movements: [
                {
                  type: "gasto",
                  amount: 8,
                  currency: "PEN",
                  description: "cafe",
                  category_id: "alimentacion",
                  occurred_at: "2026-07-15T09:30:00.000-05:00",
                  source: "whatsapp",
                },
              ],
            },
          },
        ],
      })
    );

    expect(answer.response_text).toContain("Si, tomando la respuesta anterior");
    expect(answer.response_text).toContain("09:30");
    expect(answer.safety_flags).toContain("confirmed_data_only");
  });

  it("reduce incertidumbre cuando el usuario quiere reconstruir sin datos suficientes", () => {
    const answer = composeConversationAnswer(
      contextPack({
        original_message:
          "creo que ayer gaste en taxi y comida pero no recuerdo cuanto",
        query: {
          kind: "movement_search",
          normalized_text:
            "creo que ayer gaste en taxi y comida pero no recuerdo cuanto",
          requested_amount: null,
          date_range: {
            start: "2026-07-14T00:00:00.000-05:00",
            end: "2026-07-14T23:59:59.999-05:00",
            label: "ayer",
          },
          confidence: 0.84,
        },
        turn_state: {
          act: "financial_reconstruction",
          continuity: "new_topic",
          emotional_state: "uncertain",
          experience_mode: "reconstruction",
          should_use_active_memory: false,
          should_route_to_conversation_agent: true,
          should_ask_clarification_first: false,
          response_guidance: [
            "reducir incertidumbre y preguntar solo un dato si falta evidencia",
            "ayudar a reconstruir sin crear movimientos confirmados sin datos",
          ],
          personalization_cues: ["personalizacion ligera"],
          risk_notes: ["consulta read-only"],
        },
        tool_results: [
          {
            tool_name: "query_movements",
            status: "called",
            facts: ["movement_count=0", "date_label=ayer"],
            warnings: [],
            data: {
              date_label: "ayer",
              movements: [],
            },
          },
        ],
      })
    );

    expect(answer.response_text).toContain("Lo reviso sin inventar");
    expect(answer.response_text).toContain("No encontre movimientos confirmados");
    expect(answer.response_text).toContain("Pendientes");
  });

  it("corre por AgentRuntime local sin escribir Core", async () => {
    const result = await new ConversationAgent().answer(contextPack(), "trace-1");

    expect(result.runtime.provider).toBe("local_fixture");
    expect(result.output.answer_kind).toBe("balance_snapshot");
    expect(result.tool_calls).toEqual([
      { tool_name: "get_balance_snapshot", status: "called" },
    ]);
    expect(result.safety.policy_flags).toContain("no_financial_write");
  });

  it("falla cerrado si la API sigue sin grounding despues de reparar", async () => {
    let calls = 0;
    const runtime: AgentRuntime = {
      async run<TContext, TOutput>(
        _request: AgentRuntimeRequest<TContext>
      ): Promise<AgentRuntimeResponse<TOutput>> {
        void _request;
        calls += 1;
        const output: ConversationalAnswer = {
          response_text: "Te avisare despues cuando lo revise.",
          answer_kind: "clarification",
          confidence: 0.5,
          cited_facts: [],
          used_tools: [],
          follow_up_question: null,
          safety_flags: [],
        };
        return {
          output: output as TOutput,
          confidence: output.confidence,
          tool_calls: [],
          runtime: {
            provider: "api",
            model_name: "test-model",
            latency_ms: 1,
          },
          safety: {
            policy_flags: [],
            redaction_applied: false,
          },
        };
      },
    };

    await expect(
      new ConversationAgent(runtime, false).answer(
        contextPack(),
        "trace-no-grounding-fallback"
      )
    ).rejects.toMatchObject({
      code: "RUNTIME_INVALID_RESPONSE",
    });
    expect(calls).toBe(2);
  });
});
