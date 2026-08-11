import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  ConversationalExecutiveAgent,
  ConversationalExecutiveRunResult,
} from "@/agents/conversational-executive-agent";
import type { ConversationAgent } from "@/agents/conversation-agent";
import type { DataAgent } from "@/agents/data-agent";
import { buildSafePlanningContext } from "@/agents/orchestration-planning-agent";
import { composeLocalOrchestrationPlan } from "@/agents/orchestration-planning-agent/local-fixture-runtime";
import type { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import type { PresentedTurn } from "@/core/channel/types";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import { FinancialOrchestrator } from "./financial-orchestrator";

/**
 * `RUL-LIG-01` de punta a punta: un comando de nivel `ninguna` se ejecuta en el
 * mismo turno en que se pide, y el turno lo dice.
 *
 * Lo que este test protege es la mitad que se olvida: que "sin tarjeta" no se
 * convierta en "sin decirlo". Un descarte silencioso es indistinguible, desde
 * el lado del usuario, de un descarte que no ocurrio.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const REMINDER_ID = "22222222-2222-4222-8222-222222222222";
const RECEIVED_AT = "2026-08-10T10:00:00.000-05:00";

const hoisted = vi.hoisted(() => ({
  dismissReminder: vi.fn(),
  snoozeReminder: vi.fn(),
  statusUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/data/repositories/reminders.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/reminders.repository")
  >();
  return {
    ...actual,
    dismissReminder: hoisted.dismissReminder,
    snoozeReminder: hoisted.snoozeReminder,
  };
});

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    id: "event-light-1",
    source: "dashboard" as const,
    event_type: "assistant_turn",
    idempotency_key: "idem-light-1",
    user_id: USER_ID,
    received_at: RECEIVED_AT,
    status: "received" as const,
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "trace-light",
    metadata: { thread_id: THREAD_ID } as Record<string, unknown>,
    created_at: RECEIVED_AT,
    updated_at: RECEIVED_AT,
  })),
  updateExternalEventStatus: vi.fn(async (_client, input) => {
    hoisted.statusUpdates.push(input as Record<string, unknown>);
  }),
}));

vi.mock("@/data/repositories/conversation-memory.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/conversation-memory.repository")
  >();
  return {
    ...actual,
    getActiveConversationMemoryState: vi.fn(async () => null),
    upsertConversationMemoryState: vi.fn(async () => null),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.dismissReminder.mockResolvedValue(undefined);
  hoisted.snoozeReminder.mockResolvedValue(undefined);
  hoisted.statusUpdates = [];
});

describe("RUL-LIG-01: las acciones de nivel `ninguna` se hacen en el turno", () => {
  it("“quita ese recordatorio” lo descarta de verdad y dice que no toco dinero", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intent: "descartar_recordatorio",
      target_id: REMINDER_ID,
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-light-1",
      traceId: "trace-light",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(result.reason).toBe("accepted_with_light_action_applied");
    expect(hoisted.dismissReminder).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      REMINDER_ID,
    );
    // Sin tarjeta previa, esta frase es toda la confirmacion que existe.
    expect(blockText(plans)).toMatch(/no cambié ningún movimiento ni saldo/i);
  });

  it("no sale ninguna tarjeta: no hay nada que confirmar despues de hacerlo", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intent: "descartar_recordatorio",
      target_id: REMINDER_ID,
    });

    await orchestrator.handleTurn({
      externalEventId: "event-light-1",
      traceId: "trace-light",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(plans[0]?.blocks[0]?.kind).toBe("texto");
  });

  it("un recordatorio que ya no esta se dice, y el turno no queda mudo", async () => {
    const { ReminderRepositoryError } = await import(
      "@/data/repositories/reminders.repository"
    );
    hoisted.dismissReminder.mockRejectedValue(
      new ReminderRepositoryError("NOT_FOUND", "Ese recordatorio ya no está."),
    );
    const { orchestrator, plans } = buildOrchestrator({
      intent: "descartar_recordatorio",
      target_id: REMINDER_ID,
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-light-1",
      traceId: "trace-light",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(result.reason).toBe("accepted_with_light_action_failed");
    expect(plans[0]?.blocks.length).toBeGreaterThan(0);
    expect(blockText(plans)).toMatch(/no cambié nada/i);
  });

  it("una duda declarada no ejecuta: se prefiere preguntar de mas", async () => {
    const { orchestrator } = buildOrchestrator({
      intent: "descartar_recordatorio",
      target_id: REMINDER_ID,
      ambiguities: ["No se cual de los dos"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-light-1",
      traceId: "trace-light",
      turnInput: turnInput("quita eso"),
    });

    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
    // El turno sigue su camino normal y contesta el ejecutivo.
    expect(result.status).toBe("accepted");
    expect(result.reason).not.toBe("accepted_with_light_action_applied");
  });

  it("un turno sin accion ligera no toca ningun recordatorio", async () => {
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    await orchestrator.handleTurn({
      externalEventId: "event-light-1",
      traceId: "trace-light",
      turnInput: turnInput("¿cuánto gasté esta semana?"),
    });

    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
    expect(hoisted.snoozeReminder).not.toHaveBeenCalled();
  });

  it("el evento externo deja rastro de que accion se ejecuto y como acabo", async () => {
    const { orchestrator } = buildOrchestrator({
      intent: "posponer_recordatorio",
      target_id: REMINDER_ID,
      postpone_days: 3,
    });

    await orchestrator.handleTurn({
      externalEventId: "event-light-1",
      traceId: "trace-light",
      turnInput: turnInput("recuérdamelo en tres días"),
    });

    const metadata = hoisted.statusUpdates.at(-1)?.metadata as Record<
      string,
      unknown
    >;
    expect(metadata.light_action).toBe("posponer_recordatorio");
    expect(metadata.light_action_result).toBe("applied");
  });
});

function blockText(plans: PlanTurnBlocksResult[]): string {
  return plans
    .flatMap((plan) => plan.blocks)
    .map((block) => (block as { text?: string }).text ?? "")
    .join("\n");
}

function buildOrchestrator(lightAction: {
  intent: string;
  target_id?: string;
  value?: string;
  postpone_days?: number | null;
  ambiguities?: string[];
}) {
  const planningContext = buildSafePlanningContext({
    userId: USER_ID,
    timezone: "America/Lima",
    channel: "dashboard",
    originalMessage: "accion ligera",
    receivedAt: RECEIVED_AT,
    query: {
      kind: "unsupported",
      normalized_text: "accion ligera",
      requested_amount: null,
      date_range: null,
      movement_filters: null,
      confidence: 0.4,
    },
    turnState: {
      act: "smalltalk",
      continuity: "new_topic",
      emotional_state: "neutral",
      experience_mode: "support",
      should_use_active_memory: true,
      should_route_to_conversation_agent: true,
      should_ask_clarification_first: false,
      response_guidance: [],
      personalization_cues: [],
      risk_notes: [],
    },
  });

  const executiveResult = {
    output: {
      orchestration_plan: composeLocalOrchestrationPlan(planningContext),
      turn_interpretation: {
          intent: "consulta",
          normalized_text: "texto",
          confidence: 0.9,
          ambiguities: [],
        },
        reference_resolution: {
          resolution: "no_candidate",
          candidate_movement_ids: [],
          confidence: 0.9,
        },
        tool_requests: [],
        financial_proposals: { result: [], confidence: 0.9 },
        correction_proposal: {
          is_correction: false,
          correction_kind: "none",
          target_movement_id: null,
          target_amount: null,
          target_category_id: null,
          target_account_id: null,
          target_movement_type: null,
          related_person_name: null,
          reference_resolution: "no_candidate",
          confidence: 0.6,
          requires_confirmation: true,
          ambiguities: [],
          safe_explanation: "No es una correccion.",
          evidence_signals: [],
        },
        structure_proposal: null,
        memory_control: null,
        light_action: {
          intent: lightAction.intent,
          target_id: lightAction.target_id ?? "",
          value: lightAction.value ?? "",
          postpone_days: lightAction.postpone_days ?? null,
          confidence: 0.93,
          ambiguities: lightAction.ambiguities ?? [],
        },
        response_composition: {
          response_text: "Ahora lo reviso.",
          answer_kind: "clarification",
          confidence: 0.8,
          cited_facts: [],
          used_tools: [],
          follow_up_question: null,
          safety_flags: [],
          grounded_claims: [],
          composition_stage: "safe_clarification",
        },
        confidence: 0.8,
        safety_flags: [],
      },
    runtime: {
      provider: "executive-test",
      model_name: "executive",
      latency_ms: 5,
    },
    tool_calls: [],
    tool_results: [],
    safety: { policy_flags: [], redaction_applied: false },
  } as unknown as ConversationalExecutiveRunResult;

  const plans: PlanTurnBlocksResult[] = [];

  const orchestrator = new FinancialOrchestrator(createGenericSupabaseClient(), {
    conversationalExecutiveMode: "active",
    conversationalExecutiveAgent: {
      run: vi.fn(async () => executiveResult),
    } as unknown as ConversationalExecutiveAgent,
    orchestrationPlanningAgent: {
      plan: vi.fn(async () => {
        throw new Error("el planner legado no corre con el ejecutivo activo");
      }),
    } as unknown as OrchestrationPlanningAgent,
    dataAgent: {
      extract: vi.fn(async () => {
        throw new Error("el data agent no corre con el ejecutivo activo");
      }),
    } as unknown as DataAgent,
    conversationAgent: {
      answer: vi.fn(async () => {
        throw new Error("el conversation agent no corre con el ejecutivo activo");
      }),
    } as unknown as ConversationAgent,
    presentTurn: async (plan) => {
      plans.push(plan);
      return fakePresentedTurn();
    },
  });

  return { orchestrator, plans };
}

function turnInput(text: string) {
  return {
    actor: "user" as const,
    text,
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "dashboard" as const,
  };
}

function createGenericSupabaseClient() {
  const makeBuilder = (): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop) {
          if (prop === "then") {
            return (resolve: (value: unknown) => void) =>
              resolve({ data: [], error: null });
          }
          if (prop === "maybeSingle" || prop === "single") {
            return () => Promise.resolve({ data: null, error: null });
          }
          return (..._args: unknown[]) => makeBuilder();
        },
      },
    );
  return { from: () => makeBuilder() } as unknown as never;
}

function fakePresentedTurn(): PresentedTurn {
  return {
    text: "ok",
    deliveryMode: null,
    interactiveOptionCount: null,
    sendStatus: "sent",
    sendReason: "test",
    idempotent: false,
    providerMessageId: null,
    errorCode: null,
    enhancement: {
      status: "not_applicable",
      reason: "test",
      confidence: null,
      provider: null,
      model: null,
      latencyMs: null,
      safetyFlags: [],
      styleActive: false,
      styleScope: null,
      styleAdherence: null,
      styleBlockedReasons: [],
      attemptCount: 0,
    },
  };
}
