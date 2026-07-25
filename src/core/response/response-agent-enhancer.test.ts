import { describe, expect, it } from "vitest";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime/types";
import { ResponseAgent } from "@/agents/response-agent";
import type { ResponseAgentOutput } from "@/agents/response-agent";
import type {
  ConversationStyleProfile,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type { ExternalEventLog } from "@/core/events/domain-events";
import { maybeEnhanceWhatsAppResponseWithAgent } from "./response-agent-enhancer";
import type { ResponsePlannerResult } from "./response-planner";

function externalEvent(): ExternalEventLog {
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
  };
}

function freeformPlan(
  text = "Listo. Cafe por S/8.00 registrado."
): ResponsePlannerResult {
  return {
    kind: "whatsapp_freeform",
    reason: "movement_created",
    text,
    deliveryPlan: {
      mode: "freeform",
      windowStatus: "open",
      hoursUntilClose: 24,
      requiresPaidTemplate: false,
      reason: "user_initiated_response",
    },
  };
}

function turnState(
  overrides: Partial<ConversationTurnState> = {}
): ConversationTurnState {
  return {
    act: "financial_capture",
    continuity: "new_topic",
    emotional_state: "neutral",
    experience_mode: "quick_capture",
    should_use_active_memory: false,
    should_route_to_conversation_agent: false,
    should_ask_clarification_first: false,
    response_guidance: ["confirmar sin friccion"],
    personalization_cues: ["personalizacion ligera"],
    risk_notes: [],
    ...overrides,
  };
}

describe("maybeEnhanceWhatsAppResponseWithAgent", () => {
  it("acepta una mejora que preserva los hechos", async () => {
    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan: freeformPlan(),
      responseAgent: new ResponseAgent(),
      traceId: "trace-1",
      conversationTurnState: turnState(),
    });

    expect(result.trace.status).toBe("completed");
    expect(result.responsePlan).toMatchObject({
      kind: "whatsapp_freeform",
      text: "Listo. Cafe por S/8.00 registrado. Ya quedó en tus movimientos.",
    });
  });

  it("rechaza una respuesta que pierde el monto", async () => {
    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan: freeformPlan(),
      responseAgent: new ResponseAgent(new FixedResponseRuntime("Listo.")),
      traceId: "trace-2",
      conversationTurnState: turnState(),
    });

    expect(result.trace).toMatchObject({
      status: "rejected",
      reason: "missing_amount",
    });
    expect(result.responsePlan).toEqual(freeformPlan());
  });

  it("rechaza una respuesta que pierde la promesa de saldo protegido", async () => {
    const baseText =
      "Lo separé para revisar. Falta confirmar un dato y no toca tu saldo.\n" +
      "También puedes abrir Pendientes: http://127.0.0.1:3100/?view=pending";
    const responsePlan: ResponsePlannerResult = {
      kind: "whatsapp_freeform",
      reason: "pending_created",
      text: baseText,
      deliveryPlan: {
        mode: "freeform",
        windowStatus: "open",
        hoursUntilClose: 24,
        requiresPaidTemplate: false,
        reason: "user_initiated_response",
      },
    };

    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan,
      responseAgent: new ResponseAgent(
        new FixedResponseRuntime(
          "Lo puse para revisar.\n" +
            "También puedes abrir Pendientes: http://127.0.0.1:3100/?view=pending"
        )
      ),
      traceId: "trace-3",
      conversationTurnState: turnState({ emotional_state: "anxious" }),
    });

    expect(result.trace).toMatchObject({
      status: "rejected",
      reason: "missing_safety_phrase",
    });
    expect(result.responsePlan).toEqual(responsePlan);
  });

  it("actualiza el body interactivo cuando acepta la mejora", async () => {
    const baseText =
      "Lo separé para revisar. Falta confirmar un dato y no toca tu saldo.\n" +
      "También puedes abrir Pendientes: http://127.0.0.1:3100/?view=pending";
    const responsePlan: ResponsePlannerResult = {
      kind: "whatsapp_interactive",
      reason: "pending_created",
      text: baseText,
      interactive: {
        type: "button",
        bodyText: baseText,
        buttons: [
          { id: "confirmar", title: "Confirmar" },
          { id: "descartar", title: "Descartar" },
        ],
      },
      deliveryPlan: {
        mode: "interactive",
        windowStatus: "open",
        hoursUntilClose: 24,
        requiresPaidTemplate: false,
        reason: "user_initiated_response",
      },
    };

    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan,
      responseAgent: new ResponseAgent(),
      traceId: "trace-4",
      conversationTurnState: turnState(),
    });

    expect(result.trace.status).toBe("completed");
    expect(result.responsePlan).toMatchObject({
      kind: "whatsapp_interactive",
      text:
        "Lo separé para revisar. No toca tu saldo hasta que confirmes.\n" +
        "También puedes abrir Pendientes: http://127.0.0.1:3100/?view=pending",
      interactive: {
        bodyText:
          "Lo separé para revisar. No toca tu saldo hasta que confirmes.\n" +
          "También puedes abrir Pendientes: http://127.0.0.1:3100/?view=pending",
      },
    });
  });

  it("rechaza una respuesta que inventa otro monto", async () => {
    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan: freeformPlan(),
      responseAgent: new ResponseAgent(
        new FixedResponseRuntime(
          "Listo. Cafe por S/8.00 registrado. Te quedan S/120.00."
        )
      ),
      traceId: "trace-5",
      conversationTurnState: turnState(),
    });

    expect(result.trace).toMatchObject({
      status: "rejected",
      reason: "invented_amount",
    });
    expect(result.responsePlan).toEqual(freeformPlan());
  });

  it("rechaza pedir confirmacion despues de una operacion ejecutada", async () => {
    const responsePlan = freeformPlan(
      "Listo. Registre el pago de deuda por S/30.00. Saldo pendiente S/70.00.",
    );
    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan,
      responseAgent: new ResponseAgent(
        new FixedResponseRuntime(
          "Para registrar el pago de deuda por S/30.00, ¿me confirmas? El saldo pendiente quedaria en S/70.00.",
        ),
      ),
      traceId: "trace-operation-state",
      conversationTurnState: turnState(),
    });

    expect(result.trace).toMatchObject({
      status: "rejected",
      reason: "operation_state_changed",
    });
    expect(result.responsePlan).toEqual(responsePlan);
  });

  it("rechaza inventar una cuenta como requisito de una deuda ambigua", async () => {
    const responsePlan = freeformPlan(
      "Entendi el pago, pero hay mas de una deuda compatible. Dime el nombre de la deuda o la persona para elegirla sin asumir.",
    );
    if (responsePlan.kind !== "whatsapp_freeform") {
      throw new Error("plan invalido");
    }
    responsePlan.reason = "blocked_financial_action";
    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan,
      responseAgent: new ResponseAgent(
        new FixedResponseRuntime(
          "Entendi el pago, pero hay mas de una deuda compatible. Dime el nombre de la deuda, la persona y la cuenta de origen para elegirla sin asumir.",
        ),
      ),
      traceId: "trace-account-context",
      conversationTurnState: turnState(),
    });

    expect(result.trace).toMatchObject({
      status: "rejected",
      reason: "invented_account_context",
    });
    expect(result.responsePlan).toEqual(responsePlan);
  });

  it("entrega continuidad y estado emocional al agente de experiencia", async () => {
    const runtime = new CapturingResponseRuntime();

    await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan: freeformPlan(),
      responseAgent: new ResponseAgent(runtime),
      traceId: "trace-6",
      preferredTone: "breve e informal",
      conversationTurnState: turnState({
        continuity: "follow_up",
        emotional_state: "frustrated",
        experience_mode: "correction",
      }),
    });

    expect(runtime.context?.experience).toMatchObject({
      continuity: "follow_up",
      emotional_state: "frustrated",
      experience_mode: "correction",
      preferred_tone: "breve e informal",
      avoid_repetition: true,
    });
  });

  it("aplica una instruccion libre durante toda la sesion sin depender de frases conocidas", async () => {
    const runtime = new CapturingResponseRuntime(
      "Listo. Cafe por S/8.00 registrado, como una nota breve en tu bitacora.",
    );

    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan: freeformPlan(),
      responseAgent: new ResponseAgent(runtime),
      traceId: "trace-style-session",
      conversationStyle: style({
        instruction:
          "Usa comparaciones breves de navegacion, con calidez y ve directo al punto.",
        warmth: "warm",
        directness: "direct",
        scope: "session",
      }),
      conversationTurnState: turnState(),
    });

    expect(result.trace).toMatchObject({
      status: "completed",
      style_active: true,
      style_scope: "session",
      style_adherence: "applied",
      attempt_count: 1,
    });
    expect(runtime.context?.style_contract).toMatchObject({
      active: true,
      scope: "session",
      must_apply: true,
      allowed_dimensions: ["free_instruction", "warmth", "directness"],
    });
  });

  it("reintenta con retroalimentacion explicita cuando falta una dimension mecanica", async () => {
    const runtime = new SequentialResponseRuntime([
      "Listo. Cafe por S/8.00 registrado.",
      "Listo. Cafe por S/8.00 registrado. ☕",
    ]);

    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan: freeformPlan(),
      responseAgent: new ResponseAgent(runtime),
      traceId: "trace-style-retry",
      conversationStyle: style({
        instruction: "Responde de forma alegre y usa un emoji cuando sea seguro.",
        playfulness: "light",
        emoji_policy: "limited",
      }),
      conversationTurnState: turnState(),
    });

    expect(result.trace).toMatchObject({
      status: "completed",
      attempt_count: 2,
      style_adherence: "applied",
    });
    expect(runtime.contexts).toHaveLength(2);
    expect(runtime.contexts[1]?.style_contract).toMatchObject({
      attempt: 2,
      retry_feedback: "emoji_required",
    });
    expect(result.responsePlan).toMatchObject({
      text: "Listo. Cafe por S/8.00 registrado. ☕",
    });
  });

  it("bloquea solo dimensiones expresivas en una respuesta sensible", async () => {
    const runtime = new CapturingResponseRuntime(
      "Lo separé para revisar. No toca tu saldo hasta que confirmes.",
    );
    const responsePlan = freeformPlan(
      "Lo separé para revisar. No toca tu saldo hasta que confirmes.",
    );
    if (responsePlan.kind !== "whatsapp_freeform") throw new Error("plan invalido");
    responsePlan.reason = "blocked_financial_action";

    const result = await maybeEnhanceWhatsAppResponseWithAgent({
      externalEvent: externalEvent(),
      responsePlan,
      responseAgent: new ResponseAgent(runtime),
      traceId: "trace-style-sensitive",
      conversationStyle: style({
        instruction: "Se alegre, jugueton y usa emojis, pero responde directo.",
        playfulness: "playful",
        directness: "direct",
        emoji_policy: "limited",
      }),
      conversationTurnState: turnState(),
    });

    expect(result.trace.status).toBe("completed");
    expect(runtime.context?.style_contract).toMatchObject({
      allowed_dimensions: ["free_instruction", "directness"],
      blocked_dimensions: ["playfulness", "emoji_policy"],
      emoji_mode: "forbidden",
    });
  });
});

class FixedResponseRuntime implements AgentRuntime {
  constructor(private readonly text: string) {}

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context =
      request.context_pack as import("@/agents/response-agent").ResponseContextPack;
    const styleContract = context.style_contract;

    const output: ResponseAgentOutput = {
      response_text: this.text,
      confidence: 0.9,
      preserved_facts: [],
      safety_flags: ["test_runtime"],
      style_notes: [],
      style_adherence: styleContract.must_apply
        ? "applied"
        : styleContract.active
          ? "blocked_for_safety"
          : "not_applicable",
      applied_style_dimensions: styleContract.must_apply
        ? styleContract.allowed_dimensions
        : [],
      style_evidence: styleContract.must_apply
        ? styleContract.allowed_dimensions.map((dimension) => ({
            dimension,
            evidence: this.text.slice(0, 160),
          }))
        : [],
      style_exceptions: styleContract.blocked_reasons,
    };

    return {
      output: output as TOutput,
      confidence: 0.9,
      tool_calls: [],
      runtime: {
        provider: "local_fixture",
        model_name: "fixed-response-runtime",
        latency_ms: 1,
      },
      safety: {
        policy_flags: ["test_runtime"],
        redaction_applied: false,
      },
    };
  }
}

class CapturingResponseRuntime implements AgentRuntime {
  context: import("@/agents/response-agent").ResponseContextPack | null = null;

  constructor(private readonly text?: string) {}

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>
  ): Promise<AgentRuntimeResponse<TOutput>> {
    this.context =
      request.context_pack as import("@/agents/response-agent").ResponseContextPack;
    return new FixedResponseRuntime(this.text ?? this.context.base_text).run(request);
  }
}

class SequentialResponseRuntime implements AgentRuntime {
  contexts: import("@/agents/response-agent").ResponseContextPack[] = [];

  constructor(private readonly texts: string[]) {}

  async run<TContext, TOutput>(
    request: AgentRuntimeRequest<TContext>,
  ): Promise<AgentRuntimeResponse<TOutput>> {
    const context =
      request.context_pack as import("@/agents/response-agent").ResponseContextPack;
    this.contexts.push(context);
    const text = this.texts[this.contexts.length - 1] ?? context.base_text;
    return new FixedResponseRuntime(text).run(request);
  }
}

function style(
  overrides: Partial<ConversationStyleProfile> = {},
): ConversationStyleProfile {
  return {
    instruction: "Responde de forma natural y cercana.",
    response_length: "inherit",
    formality: "inherit",
    warmth: "inherit",
    playfulness: "inherit",
    directness: "inherit",
    emoji_policy: "inherit",
    scope: "session",
    source: "explicit_user_request",
    updated_at: "2026-07-21T01:00:00.000-05:00",
    ...overrides,
  };
}
