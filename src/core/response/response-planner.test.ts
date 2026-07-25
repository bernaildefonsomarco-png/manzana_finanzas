import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ExternalEventLog } from "@/core/events/domain-events";
import {
  buildPendingItemWhatsAppCode,
  buildPendingWhatsAppCode,
} from "@/core/pending/whatsapp-pending-code";
import type { DataActionExecutionResult } from "@/core/orchestrator/data-action-executor";
import type { DataActionPendingCreationResult } from "@/core/orchestrator/data-action-pending";
import type { DataActionPlan } from "@/core/orchestrator/data-action-policy";
import type { CorrectionAgentOutput } from "@/agents/correction-agent";
import type { WhatsAppCorrectionResolutionResult } from "@/core/orchestrator/whatsapp-correction";
import type { CaptureDraftResolutionResult } from "@/core/orchestrator/capture-draft-memory";
import type { WhatsAppPendingResolutionResult } from "@/core/orchestrator/whatsapp-pending-confirmation";
import type { PendingItem } from "@/shared/types/domain";
import { planWhatsAppInboundResponse } from "./response-planner";

const pendingDeepLink = "http://127.0.0.1:3100/?view=pending";
const originalManzanaAppUrl = process.env.MANZANA_APP_URL;
const pendingButtonCode = buildPendingWhatsAppCode({
  userId: "00000000-0000-4000-8000-000000000002",
  pendingItemId: "00000000-0000-4000-8000-000000000020",
});

function externalEvent(
  overrides: Partial<ExternalEventLog> = {}
): ExternalEventLog {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    source: "whatsapp",
    event_type: "whatsapp.message_received",
    idempotency_key: "meta_cloud:message:test",
    user_id: "00000000-0000-4000-8000-000000000002",
    received_at: "2026-06-08T12:00:00.000Z",
    status: "received",
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "00000000-0000-4000-8000-000000000003",
    metadata: {
      message_type: "text",
      text: "gaste 8 cafe",
    },
    created_at: "2026-06-08T12:00:00.000Z",
    updated_at: "2026-06-08T12:00:00.000Z",
    ...overrides,
  };
}

function pendingItem(overrides: Partial<PendingItem> = {}): PendingItem {
  return {
    id: "00000000-0000-4000-8000-000000000020",
    user_id: "00000000-0000-4000-8000-000000000002",
    type: "ambiguous_movement",
    status: "pending",
    source: "ambiguous_movement",
    source_ref: "whatsapp:external:action_1",
    proposed_action: {},
    normalized_summary: {
      title: "cafe",
      amount: 8,
      currency: "PEN",
      occurred_at: "2026-06-08T12:00:00.000Z",
      category_id: "alimentacion",
    },
    dedup_status: null,
    risk_level: "medium",
    expires_at: null,
    sent_for_confirmation_at: null,
    resolved_at: null,
    resolved_by: null,
    created_at: "2026-06-08T12:00:00.000Z",
    updated_at: "2026-06-08T12:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("ResponsePlanner", () => {
  beforeEach(() => {
    process.env.MANZANA_APP_URL = "http://127.0.0.1:3100";
  });

  afterEach(() => {
    if (originalManzanaAppUrl) {
      process.env.MANZANA_APP_URL = originalManzanaAppUrl;
    } else {
      delete process.env.MANZANA_APP_URL;
    }
  });

  it("no responde por defecto si el registro natural requiere AgentRuntime", () => {
    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent(),
        windowState: null,
      })
    ).toEqual({
      kind: "no_response",
      reason: "agent_runtime_required",
      deliveryPlan: null,
    });
  });

  it("no responde por defecto si falta ResponseAgent aunque DataAgent ya corrio", () => {
    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent(),
        windowState: null,
        dataAgentCompleted: true,
      })
    ).toEqual({
      kind: "no_response",
      reason: "response_agent_required",
      deliveryPlan: null,
    });
  });

  it("responde un saludo simple sin tocar Core", () => {
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "hola",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "conversation",
    });

    expect(result).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "conversation_greeting",
      deliveryPlan: {
        mode: "freeform",
      },
    });
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "registrar gastos"
    );
  });

  it("explica ayuda basica cuando el usuario pregunta que puede hacer", () => {
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "que puedes hacer",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "conversation",
    });

    expect(result.kind).toBe("whatsapp_freeform");
    expect(result.reason).toBe("conversation_help");
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "Registrar gastos"
    );
  });

  it("responde agradecimientos sin crear accion financiera", () => {
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "gracias",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "unknown",
    });

    expect(result.kind).toBe("whatsapp_freeform");
    expect(result.reason).toBe("conversation_thanks");
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "ver pendientes"
    );
  });

  it("envia respuestas del ConversationAgent como conversation_answer", () => {
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "puedo gastar 50 hoy?",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "conversation",
      conversationAnswer: {
        response_text:
          "Con los datos actuales, si puedes cubrir S/50.00. Te quedarian aprox. S/170.00.",
        answer_kind: "balance_snapshot",
        confidence: 0.9,
        cited_facts: ["operational_free_money=S/220.00"],
        used_tools: ["get_balance_snapshot"],
        follow_up_question: null,
        safety_flags: ["read_only", "no_financial_write"],
      },
    });

    expect(result.kind).toBe("whatsapp_freeform");
    expect(result.reason).toBe("conversation_answer");
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "S/50.00"
    );
  });

  it("une una consulta mixta solo despues de un movimiento confirmado", () => {
    const execution: DataActionExecutionResult = {
      kind: "executed",
      reason: "all_ready_actions_executed",
      created_count: 1,
      idempotent_count: 0,
      movements: [
        {
          action_id: "action_1",
          movement_id: "00000000-0000-4000-8000-000000000030",
          idempotent: false,
          movement_type: "gasto",
          amount: 20,
          currency: "PEN",
          occurred_at: "2026-06-08T10:00:00.000-05:00",
          description: "desayuno",
          category_id: "alimentacion",
          account_origin_id: null,
          account_destination_id: null,
          status: "confirmed",
        },
      ],
    };

    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "registre 20 en desayuno, como voy esta semana?",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      financialActionExecution: execution,
      supplementalConversationAnswer: {
        response_text: "Esta semana llevas S/73.00 de gastos confirmados.",
        answer_kind: "balance_snapshot",
        confidence: 0.9,
        cited_facts: ["weekly_expenses=S/73.00"],
        used_tools: ["get_balance_snapshot"],
        follow_up_question: null,
        safety_flags: ["read_only", "no_financial_write"],
      },
    });

    expect(result).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "movement_created",
    });
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "Desayuno por S/20.00 registrado."
    );
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "Esta semana llevas S/73.00 de gastos confirmados."
    );
  });

  it("permite respuesta conversacional cuando una captura incompleta no puede tocar Core", () => {
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "creo que gaste en delivery, no me juzgues",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "record_movement",
      conversationTurnState: {
        act: "financial_capture",
        continuity: "new_topic",
        emotional_state: "anxious",
        experience_mode: "quick_capture",
        should_use_active_memory: false,
        should_route_to_conversation_agent: true,
        should_ask_clarification_first: true,
        response_guidance: [
          "bajar ansiedad antes de dar detalle",
          "si falta monto, cuenta o fecha, pedir solo el dato minimo necesario",
        ],
        personalization_cues: ["personalizacion ligera"],
        risk_notes: ["posible accion financiera: debe pasar por Core/PolicyGate"],
      },
      conversationAnswer: {
        response_text:
          "Lo revisamos sin culpa. Para registrarlo necesito el monto aproximado del delivery.",
        answer_kind: "clarification",
        confidence: 0.78,
        cited_facts: [],
        used_tools: [],
        follow_up_question: "Cuanto fue aproximadamente?",
        safety_flags: ["read_only", "no_financial_write"],
      },
    });

    expect(result.kind).toBe("whatsapp_freeform");
    expect(result.reason).toBe("conversation_answer");
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "sin culpa"
    );
  });

  it("responde con calma cuando una correccion queda bloqueada por politica", () => {
    const financialActionPlan: DataActionPlan = {
      kind: "blocked",
      reason: "all_actions_blocked",
      actions: [
        {
          action_id: "action_1",
          decision: "blocked",
          risk_level: "high",
          reasons: ["missing_amount", "related_person_requires_confirmation"],
          movement_input: null,
        },
      ],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 1,
    };
    const financialActionExecution: DataActionExecutionResult = {
      kind: "not_executed",
      reason: "plan_not_ready_for_core",
      created_count: 0,
      idempotent_count: 0,
      movements: [],
    };
    const pendingCreation: DataActionPendingCreationResult = {
      kind: "not_created",
      reason: "plan_not_requires_confirmation",
      created_count: 0,
      idempotent_count: 0,
      pending_items: [],
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: {
            message_type: "text",
            text: "eso no fue gasto, fue prestamo a Luis",
          },
        }),
        windowState: null,
        dataAgentCompleted: true,
        financialActionPlan,
        financialActionExecution,
        pendingCreation,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "blocked_financial_action",
      text:
        "Te entendí. No cambié nada todavía: esa corrección necesita revisión antes de tocar dinero.\n" +
        "Puedes editarla desde Movimientos: http://127.0.0.1:3100/?view=movements",
      deliveryPlan: {
        mode: "freeform",
        reason: "user_initiated_response",
      },
    });
  });

  it("responde a una correccion aunque el DataAgent caiga en no action", () => {
    const financialActionPlan: DataActionPlan = {
      kind: "no_action",
      reason: "no_proposed_actions",
      actions: [],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 0,
    };
    const financialActionExecution: DataActionExecutionResult = {
      kind: "not_executed",
      reason: "plan_not_ready_for_core",
      created_count: 0,
      idempotent_count: 0,
      movements: [],
    };
    const pendingCreation: DataActionPendingCreationResult = {
      kind: "not_created",
      reason: "plan_not_requires_confirmation",
      created_count: 0,
      idempotent_count: 0,
      pending_items: [],
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: {
            message_type: "text",
            text: "eso no fue gasto, fue prestamo a Luis",
          },
        }),
        windowState: null,
        dataAgentCompleted: true,
        dataAgentIntent: "unknown",
        financialActionPlan,
        financialActionExecution,
        pendingCreation,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "blocked_financial_action",
      text:
        "Te entendí. No cambié nada todavía: esa corrección necesita revisión antes de tocar dinero.\n" +
        "Puedes editarla desde Movimientos: http://127.0.0.1:3100/?view=movements",
    });
  });

  it("no trata una captura bloqueada como correccion", () => {
    const financialActionPlan: DataActionPlan = {
      kind: "blocked",
      reason: "all_actions_blocked",
      actions: [
        {
          action_id: "action_1",
          decision: "blocked",
          risk_level: "high",
          reasons: ["missing_amount"],
          movement_input: null,
        },
      ],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 1,
    };
    const financialActionExecution: DataActionExecutionResult = {
      kind: "not_executed",
      reason: "plan_not_ready_for_core",
      created_count: 0,
      idempotent_count: 0,
      movements: [],
    };
    const pendingCreation: DataActionPendingCreationResult = {
      kind: "not_created",
      reason: "plan_not_requires_confirmation",
      created_count: 0,
      idempotent_count: 0,
      pending_items: [],
    };

    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "hice un gasto comprando desayuno",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "record_movement",
      financialActionPlan,
      financialActionExecution,
      pendingCreation,
    });

    expect(result).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "blocked_financial_action",
    });
    const responseText = result.kind === "whatsapp_freeform" ? result.text : "";
    expect(responseText).toContain("no lo registre todavia");
    expect(responseText).not.toContain("correccion");
  });

  it("no inventa una cuenta cuando solo difiere la moneda de la deuda", () => {
    const financialActionPlan: DataActionPlan = {
      kind: "blocked",
      reason: "all_actions_blocked",
      actions: [
        {
          action_id: "action_1",
          decision: "blocked",
          risk_level: "high",
          reasons: ["debt_payment_currency_mismatch"],
          movement_input: null,
          debt_payment_input: null,
        },
      ],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 1,
    };
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "pague 10 soles de una deuda en dolares",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "record_movement",
      financialActionPlan,
      financialActionExecution: {
        kind: "not_executed",
        reason: "plan_not_ready_for_core",
        created_count: 0,
        idempotent_count: 0,
        movements: [],
      },
      pendingCreation: {
        kind: "not_created",
        reason: "plan_not_requires_confirmation",
        created_count: 0,
        idempotent_count: 0,
        pending_items: [],
      },
    });

    expect(result).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "blocked_financial_action",
      text: "No registre el pago porque la moneda no coincide con la deuda.",
    });
  });

  it("pide solo la primera fecha cuando el borrador de deuda en cuotas esta incompleto", () => {
    const financialActionPlan: DataActionPlan = {
      kind: "blocked",
      reason: "all_actions_blocked",
      actions: [
        {
          action_id: "action_1",
          decision: "blocked",
          risk_level: "medium",
          reasons: ["debt_creation_first_due_date_missing"],
          movement_input: null,
          debt_payment_input: null,
          debt_creation_input: null,
        },
      ],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 1,
    };
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: {
          message_type: "text",
          text: "Juan me presto 100 soles, le voy a pagar en 5 cuotas",
        },
      }),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "record_movement",
      financialActionPlan,
      financialActionExecution: {
        kind: "not_executed",
        reason: "no_ready_actions",
        created_count: 0,
        idempotent_count: 0,
        movements: [],
      },
    });

    expect(result).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "blocked_financial_action",
    });
    const text = result.kind === "whatsapp_freeform" ? result.text : "";
    expect(text).toContain("Cuando vence la primera cuota");
    expect(text).not.toContain("cuenta");
    expect(text).not.toContain("categoria");
  });

  it("llama borrador a la deuda completa y niega explicitamente haberla creado", () => {
    const financialActionPlan: DataActionPlan = {
      kind: "blocked",
      reason: "all_actions_blocked",
      actions: [
        {
          action_id: "action_1",
          decision: "blocked",
          risk_level: "medium",
          reasons: ["debt_creation_confirmation_required"],
          movement_input: null,
          debt_payment_input: null,
          debt_creation_input: {
            direction: "i_owe",
            kind: "personal",
            name: "Deuda con Juan",
            related_person_name: "Juan",
            principal_amount: 100,
            currency: "PEN",
            opened_at: "2026-07-24",
            first_due_date: "2026-07-30",
            installment_count: 5,
            installment_amount: 20,
            interest_notes: null,
            account_id: null,
            movement_type: "prestamo_recibido",
          },
        },
      ],
      ready_count: 0,
      requires_confirmation_count: 0,
      blocked_count: 1,
    };
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent(),
      windowState: null,
      dataAgentCompleted: true,
      dataAgentIntent: "record_movement",
      financialActionPlan,
      financialActionExecution: {
        kind: "not_executed",
        reason: "no_ready_actions",
        created_count: 0,
        idempotent_count: 0,
        movements: [],
      },
    });

    expect(result).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "blocked_financial_action",
    });
    const text = result.kind === "whatsapp_freeform" ? result.text : "";
    expect(text).toContain("Deuda con Juan");
    expect(text).toContain("Borrador:");
    expect(text).toContain("S/100.00");
    expect(text).toContain("5 cuotas");
    expect(text).toContain("Todavia no la cree ni cambie tu saldo");
    expect(text).toContain("La confirmas");
  });

  it("confirma deuda y calendario solo despues del resultado de Core", () => {
    const execution: DataActionExecutionResult = {
      kind: "executed",
      reason: "all_ready_actions_executed",
      created_count: 1,
      idempotent_count: 0,
      movements: [],
      debts: [
        {
          action_id: "action_1",
          debt_id: "00000000-0000-4000-8000-0000000000d9",
          idempotent: false,
          name: "Deuda con Juan",
          direction: "i_owe",
          principal_amount: 100,
          current_balance: 100,
          currency: "PEN",
          installment_count: 5,
          first_due_date: "2026-07-30",
          movement_id: null,
        },
      ],
    };
    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent(),
      windowState: null,
      dataAgentCompleted: true,
      financialActionExecution: execution,
    });

    expect(result).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "movement_created",
    });
    const text = result.kind === "whatsapp_freeform" ? result.text : "";
    expect(text).toContain("Cree Deuda con Juan por S/100.00");
    expect(text).toContain("calendario de 5 cuotas");
    expect(text).toContain("30/07/2026");
    expect(text).toContain("no cambio el saldo de ninguna cuenta");
  });

  it("pide confirmacion interactiva para una correccion segura", () => {
    const correctionProposal: CorrectionAgentOutput = {
      kind: "requires_confirmation",
      reason: "single_candidate",
      confidence: 0.87,
      safe_explanation:
        "Encontre un movimiento reciente que coincide, pero necesito confirmacion.",
      command: {
        command_id:
          "corr:loan_to:00000000-0000-4000-8000-000000000010:luis",
        movement_id: "00000000-0000-4000-8000-000000000010",
        operation: "patch",
        correction_type: "loan",
        corrected_fields: {
          type: "prestamo_dado",
          description: "Prestamo a Luis",
          merchant: null,
          category_id: null,
          related_person_id: null,
          debt_id: null,
        },
        delete_mode: null,
        user_correction_text: "eso no fue gasto, fue prestamo a Luis",
        summary: "Cambiar a prestamo a Luis",
        button_title: "Almuerzo S/20",
        movement_label: "Almuerzo S/20",
        target_label: "prestamo a Luis",
        target_type: "prestamo_dado",
        related_person_name: "Luis",
      },
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: {
            message_type: "text",
            text: "eso no fue gasto, fue prestamo a Luis",
          },
        }),
        windowState: null,
        dataAgentCompleted: true,
        dataAgentIntent: "correction",
        correctionProposal,
      })
    ).toMatchObject({
      kind: "whatsapp_interactive",
      reason: "correction_needs_confirmation",
      text: "Creo que te refieres a Almuerzo S/20. ¿Lo cambio a prestamo a Luis?",
      interactive: {
        type: "button",
        buttons: [
          {
            id: "corr:loan_to:00000000-0000-4000-8000-000000000010:luis",
            title: "Sí, cambiar",
          },
          { id: "corr:cancel", title: "No cambiar" },
        ],
      },
    });
  });

  it("confirma una correccion aplicada por el Core", () => {
    const correctionResolution: WhatsAppCorrectionResolutionResult = {
      kind: "applied",
      reason: "correction_applied",
      idempotent: false,
      summary: "Almuerzo S/20.00 como prestamo a Luis",
      command: {
        kind: "loan_to",
        command_id:
          "corr:loan_to:00000000-0000-4000-8000-000000000010:luis",
        movement_id: "00000000-0000-4000-8000-000000000010",
        target_type: "prestamo_dado",
        related_person_name: "Luis",
      },
      movement: {
        id: "00000000-0000-4000-8000-000000000010",
        user_id: "00000000-0000-4000-8000-000000000002",
        type: "prestamo_dado",
        status: "corrected",
        amount: 20,
        currency: "PEN",
        occurred_at: "2026-06-08T12:00:00.000Z",
        description: "Prestamo a Luis",
        merchant: null,
        category_id: null,
        subcategory_id: null,
        source: "whatsapp",
        source_ref: "whatsapp:external:action_1",
        idempotency_key: "whatsapp:test",
        confidence: 0.9,
        requires_review: false,
        account_origin_id: null,
        account_destination_id: null,
        box_origin_id: null,
        box_destination_id: null,
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
        related_person_id: null,
        affects_total_balance: false,
        affects_account_balance: false,
        created_at: "2026-06-08T12:00:00.000Z",
        updated_at: "2026-06-08T12:01:00.000Z",
        deleted_at: null,
        metadata: {
          related_person_name: "Luis",
        },
      },
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: {
            message_type: "button",
            text: "corr:loan_to:00000000-0000-4000-8000-000000000010:luis",
          },
        }),
        windowState: null,
        correctionResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "correction_applied",
      text:
        "Listo. Cambié Almuerzo S/20.00 como prestamo a Luis. Tus saldos ya se recalcularon.",
    });
  });

  it("no responde a eventos sin usuario conocido", () => {
    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({ user_id: null }),
        windowState: null,
        autoAckEnabled: true,
      })
    ).toMatchObject({
      kind: "no_response",
      reason: "missing_user",
    });
  });

  it("no responde a mensajes no texto en V1 inicial", () => {
    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: {
            message_type: "image",
            text: null,
          },
        }),
        windowState: null,
        autoAckEnabled: true,
      })
    ).toMatchObject({
      kind: "no_response",
      reason: "non_text_message",
    });
  });

  it("puede generar ack local solo si se habilita explicitamente", () => {
    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent(),
        windowState: null,
        autoAckEnabled: true,
        now: new Date("2026-06-08T12:00:00.000Z"),
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "local_auto_ack",
      deliveryPlan: {
        mode: "freeform",
        reason: "user_initiated_response",
      },
    });
  });

  it("confirma un movimiento creado con una respuesta especifica", () => {
    const execution: DataActionExecutionResult = {
      kind: "executed",
      reason: "all_ready_actions_executed",
      created_count: 1,
      idempotent_count: 0,
      movements: [
        {
          action_id: "action_1",
          movement_id: "00000000-0000-4000-8000-000000000010",
          idempotent: false,
          movement_type: "gasto",
          amount: 8,
          currency: "PEN",
          occurred_at: "2026-06-08T10:00:00.000-05:00",
          description: "cafe",
          category_id: "alimentacion",
          account_origin_id: "00000000-0000-4000-8000-000000000011",
          account_destination_id: null,
          status: "confirmed",
        },
      ],
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent(),
        windowState: null,
        dataAgentCompleted: true,
        financialActionExecution: execution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "movement_created",
      text: "Listo. Cafe por S/8.00 registrado.",
    });
  });

  it("confirma un pago de deuda con el saldo restante", () => {
    const execution: DataActionExecutionResult = {
      kind: "executed",
      reason: "all_ready_actions_executed",
      created_count: 1,
      idempotent_count: 0,
      movements: [
        {
          action_id: "action_debt_1",
          movement_id: "00000000-0000-4000-8000-000000000012",
          idempotent: false,
          movement_type: "pago_deuda",
          amount: 30,
          currency: "PEN",
          occurred_at: "2026-07-22T10:00:00.000-05:00",
          description: "Primera cuota de Pedro",
          category_id: null,
          account_origin_id: null,
          account_destination_id: null,
          status: "confirmed",
          debt_id: "00000000-0000-4000-8000-0000000000d1",
          debt_name: "Prestamo Pedro",
          debt_remaining_balance: 70,
          debt_payment_id: "00000000-0000-4000-8000-0000000000b1",
        },
      ],
    };

    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent(),
      windowState: null,
      dataAgentCompleted: true,
      financialActionExecution: execution,
    });

    expect(result.kind).toBe("whatsapp_freeform");
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "Registre el pago de Prestamo Pedro por S/30.00",
    );
    expect(result.kind === "whatsapp_freeform" ? result.text : "").toContain(
      "Saldo pendiente: S/70.00",
    );
  });

  it("explica cuando registra un movimiento claro sin cuenta", () => {
    const execution: DataActionExecutionResult = {
      kind: "executed",
      reason: "all_ready_actions_executed",
      created_count: 1,
      idempotent_count: 0,
      movements: [
        {
          action_id: "action_1",
          movement_id: "00000000-0000-4000-8000-000000000010",
          idempotent: false,
          movement_type: "gasto",
          amount: 10,
          currency: "PEN",
          occurred_at: "2026-06-08T10:00:00.000-05:00",
          description: "desayuno",
          category_id: "alimentacion",
          account_origin_id: null,
          account_destination_id: null,
          status: "confirmed",
        },
      ],
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent(),
        windowState: null,
        dataAgentCompleted: true,
        financialActionExecution: execution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "movement_created",
      text:
        "Listo. Desayuno por S/10.00 registrado. " +
        "Quedó sin cuenta por ahora, así que no moví ningún saldo de cuenta.",
    });
  });

  it("explica cuando separa un pendiente sin tocar saldo", () => {
    const pendingCreation: DataActionPendingCreationResult = {
      kind: "created",
      reason: "pending_items_created",
      created_count: 1,
      idempotent_count: 0,
      pending_items: [
        {
          action_id: "action_1",
          pending_item_id: "00000000-0000-4000-8000-000000000020",
          idempotent: false,
          type: "ambiguous_movement",
          source: "ambiguous_movement",
          risk_level: "medium",
          status: "pending",
        },
      ],
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent(),
        windowState: null,
        dataAgentCompleted: true,
        pendingCreation,
      })
    ).toMatchObject({
      kind: "whatsapp_interactive",
      reason: "pending_created",
      text:
        "Lo separé para revisar. Falta confirmar un dato y no toca tu saldo.\n" +
        `También puedes abrir Pendientes: ${pendingDeepLink}`,
      deliveryPlan: {
        mode: "interactive",
      },
      interactive: {
        type: "button",
        buttons: [
          { id: `confirmar ${pendingButtonCode}`, title: "Confirmar" },
          { id: `descartar ${pendingButtonCode}`, title: "Descartar" },
        ],
      },
    });
  });

  it("resume un lote mixto sin ocultar ni lo ejecutado ni lo pendiente", () => {
    const financialActionExecution: DataActionExecutionResult = {
      kind: "executed",
      reason: "all_ready_actions_executed",
      created_count: 1,
      idempotent_count: 0,
      movements: [
        {
          action_id: "clear_action",
          movement_id: "00000000-0000-4000-8000-000000000010",
          idempotent: false,
          movement_type: "gasto",
          amount: 20,
          currency: "PEN",
          occurred_at: "2026-07-24T10:00:00.000-05:00",
          description: "desayuno",
          category_id: "alimentacion",
          account_origin_id: "00000000-0000-4000-8000-000000000011",
          account_destination_id: null,
          status: "confirmed",
        },
      ],
    };
    const pendingCreation: DataActionPendingCreationResult = {
      kind: "created",
      reason: "pending_items_created",
      created_count: 1,
      idempotent_count: 0,
      pending_items: [
        {
          action_id: "ambiguous_action",
          pending_item_id: "00000000-0000-4000-8000-000000000020",
          idempotent: false,
          type: "ambiguous_movement",
          source: "ambiguous_movement",
          risk_level: "medium",
          status: "pending",
        },
      ],
    };

    const result = planWhatsAppInboundResponse({
      externalEvent: externalEvent(),
      windowState: null,
      dataAgentCompleted: true,
      financialActionExecution,
      pendingCreation,
    });

    expect(result).toMatchObject({
      kind: "whatsapp_interactive",
      reason: "mixed_actions_processed",
      interactive: {
        buttons: [
          { id: `confirmar ${pendingButtonCode}`, title: "Confirmar" },
          { id: `descartar ${pendingButtonCode}`, title: "Descartar" },
        ],
      },
    });
    const text =
      result.kind === "whatsapp_interactive" ? result.text : "";
    expect(text).toContain("Desayuno por S/20.00 registrado.");
    expect(text).toContain("Falta confirmar un dato");
    expect(text).toContain("no toca tu saldo");
  });

  it("mantiene respuesta de texto para pendientes sensibles", () => {
    const pendingCreation: DataActionPendingCreationResult = {
      kind: "created",
      reason: "pending_items_created",
      created_count: 1,
      idempotent_count: 0,
      pending_items: [
        {
          action_id: "action_1",
          pending_item_id: "00000000-0000-4000-8000-000000000020",
          idempotent: false,
          type: "risk_confirmation",
          source: "ambiguous_movement",
          risk_level: "sensitive",
          status: "pending",
        },
      ],
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent(),
        windowState: null,
        dataAgentCompleted: true,
        pendingCreation,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_created",
      text:
        "Lo separé para revisar con calma. No toca tu saldo hasta que confirmes.\n" +
        `También puedes abrir Pendientes: ${pendingDeepLink}`,
    });
  });

  it("confirma un pendiente resuelto desde WhatsApp", () => {
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "confirmed",
      reason: "single_pending_confirmed",
      action: "confirm",
      pending_code: null,
      pending_count: 1,
      idempotent: false,
      pending_item: pendingItem(),
      movement: {
        id: "00000000-0000-4000-8000-000000000021",
        user_id: "00000000-0000-4000-8000-000000000002",
        type: "gasto",
        status: "confirmed",
        amount: 8,
        currency: "PEN",
        occurred_at: "2026-06-08T12:00:00.000Z",
        description: "cafe",
        merchant: "cafe",
        category_id: "alimentacion",
        subcategory_id: null,
        source: "whatsapp",
        source_ref: "pending:00000000-0000-4000-8000-000000000020",
        idempotency_key: "pending-confirm:00000000-0000-4000-8000-000000000020",
        confidence: 0.7,
        requires_review: false,
        account_origin_id: null,
        account_destination_id: null,
        box_origin_id: null,
        box_destination_id: null,
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
        related_person_id: null,
        affects_total_balance: false,
        affects_account_balance: false,
        created_at: "2026-06-08T12:00:00.000Z",
        updated_at: "2026-06-08T12:00:00.000Z",
        deleted_at: null,
        metadata: {},
      },
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({ metadata: { message_type: "text", text: "confirmo" } }),
        windowState: null,
        pendingResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_confirmed",
      text: "Listo. Cafe por S/8.00 confirmado.",
    });
  });

  it("confirma un pendiente descartado desde WhatsApp", () => {
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "discarded",
      reason: "single_pending_discarded",
      action: "discard",
      pending_code: null,
      pending_count: 1,
      idempotent: false,
      pending_item: pendingItem({ status: "discarded" }),
      movement: null,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "descarta eso" },
        }),
        windowState: null,
        pendingResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_discarded",
      text: "Listo. Ese pendiente quedó descartado. No tocaba tu saldo.",
    });
  });

  it("pide elegir cuando hay varios pendientes para descartar", () => {
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "needs_clarification",
      reason: "multiple_active_pending",
      action: "discard",
      pending_code: null,
      pending_count: 2,
      pending_item: null,
      movement: null,
      idempotent: false,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "cancelar" },
        }),
        windowState: null,
        pendingResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_resolution_needs_clarification",
      text:
        'Tienes varios pendientes. Escribe "ver pendientes" para ver los códigos y elegir cuál descartar.\n' +
        `También puedes abrir Pendientes: ${pendingDeepLink}`,
    });
  });

  it("lista pendientes activos sin resolverlos desde WhatsApp", () => {
    const taxiPending = pendingItem({
      id: "00000000-0000-4000-8000-000000000030",
      normalized_summary: {
        title: "taxi",
        amount: 15,
        currency: "PEN",
        occurred_at: "2026-06-08T12:00:00.000Z",
        category_id: "transporte",
      },
    });
    const cafePending = pendingItem({
      id: "00000000-0000-4000-8000-000000000031",
    });
    const taxiCode = buildPendingItemWhatsAppCode(taxiPending);
    const cafeCode = buildPendingItemWhatsAppCode(cafePending);
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "listed",
      reason: "active_pending_listed",
      action: "list",
      pending_code: null,
      pending_count: 2,
      pending_items: [taxiPending, cafePending],
      pending_item: null,
      movement: null,
      idempotent: false,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "ver pendientes" },
        }),
        windowState: null,
        pendingResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_listed",
      text:
        "Tienes 2 pendientes por revisar:\n" +
        `1. ${taxiCode} - Taxi - S/15.00\n` +
        `2. ${cafeCode} - Cafe - S/8.00\n` +
        "Para resolver uno: confirma P-XXXX o cancela P-XXXX.\n" +
        `También puedes abrir Pendientes: ${pendingDeepLink}`,
    });
  });

  it("responde con calma cuando no hay pendientes que listar", () => {
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "listed",
      reason: "no_active_pending_to_list",
      action: "list",
      pending_code: null,
      pending_count: 0,
      pending_items: [],
      pending_item: null,
      movement: null,
      idempotent: false,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "ver pendientes" },
        }),
        windowState: null,
        pendingResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_listed",
      text: "No tienes pendientes por revisar. Nada pendiente esta tocando tu saldo.",
    });
  });

  it("explica cuando el codigo de pendiente no existe", () => {
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "needs_clarification",
      reason: "pending_code_not_found",
      action: "confirm",
      pending_code: "P-ABC12345",
      pending_count: 2,
      pending_item: null,
      movement: null,
      idempotent: false,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "confirmar P-ABC12345" },
        }),
        windowState: null,
        pendingResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_resolution_needs_clarification",
      text: 'No encontre P-ABC12345 entre tus pendientes activos. Escribe "ver pendientes" para ver la lista actual.',
    });
  });

  it("pide completar cuentas antes de confirmar una transferencia ambigua", () => {
    const item = pendingItem({
      source: "email_pending",
      proposed_action: {
        action: "review_specialized",
        movement_type: "transferencia",
      },
    });
    const code = buildPendingItemWhatsAppCode(item);
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "needs_clarification",
      reason: "pending_requires_details",
      action: "confirm",
      pending_code: code,
      pending_count: 1,
      pending_item: item,
      movement: null,
      idempotent: false,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: {
            message_type: "text",
            text: `confirmar ${code}`,
          },
        }),
        windowState: null,
        pendingResolution,
      }),
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_resolution_needs_clarification",
      text: expect.stringContaining(
        "la cuenta de origen y la cuenta de destino",
      ),
    });
  });

  it("propone cuentas reales y permite gasto sin cuenta al revisar", () => {
    const item = pendingItem({
      source: "email_pending",
      proposed_action: {
        action: "review_specialized",
        movement_type: "transferencia",
      },
      metadata: {
        account_origin_hint: "Clásica ****3087",
        account_destination_hint: "Clásica ****9039",
      },
    });
    const code = buildPendingItemWhatsAppCode(item);
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "reviewed",
      reason: "pending_account_options_proposed",
      action: "review",
      pending_code: code,
      pending_count: 1,
      pending_item: item,
      account_options: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Tarjeta BCP",
          institution: "BCP",
          currency: "PEN",
          is_default: true,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Efectivo",
          institution: null,
          currency: "PEN",
          is_default: false,
        },
      ],
      movement: null,
      idempotent: false,
    };

    const response = planWhatsAppInboundResponse({
      externalEvent: externalEvent({
        metadata: { message_type: "text", text: `revisar ${code}` },
      }),
      windowState: null,
      pendingResolution,
    });

    expect(response).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "pending_reviewed",
    });
    expect("text" in response ? response.text : "").toContain("Tarjeta BCP");
    expect("text" in response ? response.text : "").toContain("Efectivo");
    expect("text" in response ? response.text : "").toContain(
      "gasto sin cuenta",
    );
  });

  it("vuelve a pedir confirmacion despues de completar la transferencia", () => {
    const item = pendingItem({
      source: "email_pending",
      status: "user_edited",
      proposed_action: {
        action: "record_transfer",
        movement_type: "transferencia",
        account_origin_id: "11111111-1111-4111-8111-111111111111",
        account_destination_id: "22222222-2222-4222-8222-222222222222",
      },
    });
    const code = buildPendingItemWhatsAppCode(item);
    const pendingResolution: WhatsAppPendingResolutionResult = {
      kind: "updated",
      reason: "pending_ready_for_confirmation",
      action: "assign_transfer",
      pending_code: code,
      pending_count: 1,
      pending_item: item,
      account_options: [
        {
          id: "11111111-1111-4111-8111-111111111111",
          name: "Tarjeta BCP",
          institution: "BCP",
          currency: "PEN",
          is_default: true,
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          name: "Efectivo",
          institution: null,
          currency: "PEN",
          is_default: false,
        },
      ],
      ready_for_confirmation: true,
      learned_account_hints: [],
      movement: null,
      idempotent: false,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: {
            message_type: "text",
            text: `${code} fue de Tarjeta BCP a Efectivo`,
          },
        }),
        windowState: null,
        pendingResolution,
      }),
    ).toMatchObject({
      kind: "whatsapp_interactive",
      reason: "pending_updated",
      text: expect.stringContaining("Aún no registré nada"),
      interactive: {
        buttons: [
          { id: `confirmar ${code}`, title: "Confirmar" },
          { id: `descartar ${code}`, title: "Descartar" },
        ],
      },
    });
  });

  it("responde cuando el usuario confirma algo reciente pero no hay borrador activo", () => {
    const captureDraftResolution: CaptureDraftResolutionResult = {
      kind: "needs_clarification",
      reason: "no_active_capture_draft",
      action: "confirm",
      draft: null,
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "registralo" },
        }),
        windowState: null,
        captureDraftResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "capture_draft_needs_clarification",
      text:
        'No encontre algo reciente para registrar con seguridad. Escribeme el movimiento completo, por ejemplo: "gaste 20 en desayuno".',
    });
  });

  it("responde cuando el usuario descarta un borrador conversacional", () => {
    const captureDraftResolution: CaptureDraftResolutionResult = {
      kind: "discarded",
      reason: "active_capture_draft_discarded",
      action: "discard",
      draft: {
        state_id: "memory-state-1",
        reason: "financial_capture_no_action",
        original_message: "hice un gasto de 20 soles comprando desayuno",
        received_at: "2026-07-16T15:00:00.000-05:00",
        source_ref: "external-event-1",
        created_at: "2026-07-16T15:00:00.000-05:00",
        data_agent_output: null,
        financial_plan: null,
      },
    };

    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "descartalo" },
        }),
        windowState: null,
        captureDraftResolution,
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "capture_draft_discarded",
      text: "Listo. No registre eso y no toque tu saldo.",
    });
  });

  it("no deja en silencio una captura que no pudo estructurarse", () => {
    expect(
      planWhatsAppInboundResponse({
        externalEvent: externalEvent({
          metadata: { message_type: "text", text: "anota lo del desayuno" },
        }),
        windowState: null,
        dataAgentCompleted: true,
        dataAgentIntent: "record_movement",
        conversationTurnState: {
          act: "financial_capture",
          continuity: "new_topic",
          emotional_state: "neutral",
          experience_mode: "quick_capture",
          should_use_active_memory: false,
          should_route_to_conversation_agent: false,
          should_ask_clarification_first: true,
          personalization_cues: [],
          response_guidance: [],
          risk_notes: [],
        },
        financialActionPlan: {
          kind: "no_action",
          reason: "no_proposed_actions",
          ready_count: 0,
          requires_confirmation_count: 0,
          blocked_count: 0,
          actions: [],
        },
        financialActionExecution: {
          kind: "not_executed",
          reason: "no_ready_actions",
          created_count: 0,
          idempotent_count: 0,
          movements: [],
        },
        pendingCreation: {
          kind: "not_created",
          reason: "no_confirmable_actions",
          created_count: 0,
          idempotent_count: 0,
          pending_items: [],
        },
      })
    ).toMatchObject({
      kind: "whatsapp_freeform",
      reason: "capture_needs_clarification",
    });
  });
});
