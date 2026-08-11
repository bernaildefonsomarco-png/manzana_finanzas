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
 * `WEB-D298`: el silencio nunca es una respuesta aceptable.
 *
 * Cuatro puertas del motor devolvian `null` por motivos incompatibles —"este
 * turno no pedia nada de eso" y "lo pedia y no se pudo"— y desde fuera se veian
 * iguales. Las cuatro acababan igual: el turno contestaba amable y la persona se
 * quedaba creyendo que su orden se cumplio.
 *
 * Cada puerta se prueba en sus tres finales, porque la gracia esta justo en la
 * diferencia:
 *
 *  - no aplicaba  → sigue callando (y eso es correcto);
 *  - falta un dato → pregunta;
 *  - fallo         → lo dice, con su via manual (`ERR-ASI-01`).
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const REMINDER_ID = "22222222-2222-4222-8222-222222222222";
const RECEIVED_AT = "2026-08-11T10:00:00.000-05:00";

const hoisted = vi.hoisted(() => ({
  dismissReminder: vi.fn(),
  snoozeReminder: vi.fn(),
  listFinancialMemory: vi.fn(),
  getLearningPreferences: vi.fn(),
  setLearningPreferences: vi.fn(),
  buildPreferenceProposal: vi.fn(),
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

vi.mock("@/data/repositories/financial-memory.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/financial-memory.repository")
  >();
  return {
    ...actual,
    getLearningPreferences: hoisted.getLearningPreferences,
    setLearningPreferences: hoisted.setLearningPreferences,
    listFinancialMemory: hoisted.listFinancialMemory,
    searchConfirmedFinancialMemory: vi.fn(async () => []),
  };
});

vi.mock("@/core/preferences/preference-executor", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/core/preferences/preference-executor")
  >();
  return {
    ...actual,
    buildPreferenceProposal: (
      input: Parameters<typeof actual.buildPreferenceProposal>[0],
    ) =>
      hoisted.buildPreferenceProposal.getMockImplementation()
        ? hoisted.buildPreferenceProposal(input)
        : actual.buildPreferenceProposal(input),
  };
});

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    id: "event-silent-1",
    source: "dashboard" as const,
    event_type: "assistant_turn",
    idempotency_key: "idem-silent-1",
    user_id: USER_ID,
    received_at: RECEIVED_AT,
    status: "received" as const,
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "trace-silent",
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
  hoisted.listFinancialMemory.mockResolvedValue([]);
  hoisted.getLearningPreferences.mockResolvedValue({
    enabled: true,
    allow_narrative_memory: true,
    allow_sensitive_memory: false,
  });
  hoisted.setLearningPreferences.mockResolvedValue({});
  hoisted.buildPreferenceProposal.mockReset();
  hoisted.statusUpdates = [];
});

describe("puerta 1 — la orden de memoria que la base no pudo atender", () => {
  it("si la memoria se cae, el turno lo dice en vez de contestar amable", async () => {
    hoisted.listFinancialMemory.mockRejectedValue(new Error("memoria caida"));
    const { orchestrator, plans } = buildOrchestrator({
      memory_control: memoryIntent("list"),
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("¿qué te acordás de mí?"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
    expect(blockText(plans)).toMatch(/no cambié nada/i);
  });

  it("olvidar algo y que falle deja constancia de que no se olvido nada", async () => {
    hoisted.listFinancialMemory.mockRejectedValue(new Error("memoria caida"));
    const { orchestrator } = buildOrchestrator({
      memory_control: memoryIntent("forget", "lo de Acme"),
    });

    await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("olvidate de que trabajo en Acme"),
    });

    const metadata = hoisted.statusUpdates.at(-1)?.metadata as Record<
      string,
      unknown
    >;
    expect(metadata.orchestrator_reason).toBe("accepted_with_action_not_honored");
    expect(metadata.unhonored_reason).toBe("memory_control_failed");
  });

  it("un turno que no habla de memoria sigue sin decir nada de memoria", async () => {
    const { orchestrator } = buildOrchestrator({});

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("¿cuánto gasté esta semana?"),
    });

    expect(result.reason).not.toBe("accepted_with_action_not_honored");
    expect(hoisted.listFinancialMemory).not.toHaveBeenCalled();
  });
});

describe("puerta 2 — la accion ligera que el modelo casi entendio", () => {
  it("una duda declarada se pregunta, no se deja caer", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      light_action: {
        ...lightActionIntent(),
        ambiguities: ["¿Cuál de los tres recordatorios?"],
      },
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(result.reason).toBe("accepted_with_action_clarification");
    expect(plans[0]?.blocks[0]?.kind).toBe("pregunta");
    expect(blockText(plans)).toContain("¿Cuál de los tres recordatorios?");
    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
  });

  it("un objetivo que no es un id de tool se declara: no se ejecuta y se dice", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      light_action: { ...lightActionIntent(), target_id: "el del gimnasio" },
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("quita el del gimnasio"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
  });

  it("poca confianza sigue siendo silencio: no consta que pidiera una accion", async () => {
    const { orchestrator } = buildOrchestrator({
      light_action: { ...lightActionIntent(), confidence: 0.4 },
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("no sé, algo de recordatorios"),
    });

    expect(result.reason).not.toBe("accepted_with_action_not_honored");
    expect(result.reason).not.toBe("accepted_with_action_clarification");
    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
  });
});

describe("puerta 3 — el cambio de preferencia que no llego a tarjeta", () => {
  it("un plazo fuera de rango se pregunta en vez de desaparecer", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      preference_change: { ...preferenceIntent(), pausar_dias: 365 },
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("pausá mis recordatorios un año"),
    });

    expect(result.reason).toBe("accepted_with_action_clarification");
    expect(plans[0]?.blocks[0]?.kind).toBe("pregunta");
    expect(blockText(plans)).toMatch(/cuántos días/i);
  });

  it("un borrador que no valida se dice: la persona pidio pausar sus avisos", async () => {
    hoisted.buildPreferenceProposal.mockImplementation(() => null);
    const { orchestrator, plans } = buildOrchestrator({
      preference_change: preferenceIntent(),
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("pausá mis recordatorios hasta el lunes"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
    const metadata = hoisted.statusUpdates.at(-1)?.metadata as Record<
      string,
      unknown
    >;
    expect(metadata.unhonored_reason).toBe("preference_proposal_invalid");
  });

  it("un turno que no pide preferencias no anuncia ningun limite", async () => {
    const { orchestrator } = buildOrchestrator({});

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("hola"),
    });

    expect(result.reason).not.toBe("accepted_with_action_not_honored");
  });
});

describe("puerta 4 — la planificacion que se cae con la intencion dentro", () => {
  it("si el planner se cae despues de que el ejecutivo hablo, la orden no se evapora", async () => {
    // El ejecutivo entendio "descarta ese recordatorio" pero su composicion fue
    // rechazada, asi que el turno degrada al planner legado... que tampoco
    // responde. Antes, ahi se perdia todo sin decir nada.
    const { orchestrator, plans } = buildOrchestrator(
      { light_action: lightActionIntent() },
      { compositionRejected: true, legacyPlannerFails: true },
    );

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
  });

  it("si se cae sin que nadie entendiera nada, no se inventa un aviso", async () => {
    // El ejecutivo tambien falla: nunca se supo que pedia la persona. Anunciar
    // "no pude hacer lo que pediste" seria inventarle un pedido.
    const { orchestrator } = buildOrchestrator(
      {},
      { executiveFails: true, legacyPlannerFails: true },
    );

    const result = await orchestrator.handleTurn({
      externalEventId: "event-silent-1",
      traceId: "trace-silent",
      turnInput: turnInput("¿cuánto gasté esta semana?"),
    });

    expect(result.reason).not.toBe("accepted_with_action_not_honored");
    expect(result.status).toBe("accepted");
  });
});

function memoryIntent(intent: string, target = "") {
  return {
    intent,
    target,
    replacement: "",
    confidence: 0.95,
    ambiguities: [],
  };
}

function lightActionIntent() {
  return {
    intent: "descartar_recordatorio",
    target_id: REMINDER_ID,
    value: "",
    postpone_days: null,
    confidence: 0.93,
    ambiguities: [],
  };
}

function preferenceIntent() {
  return {
    intent: "pausar_recordatorios",
    activar: true,
    reminder_kind: "",
    pausar_dias: 3,
    desde_hora: null,
    hasta_hora: null,
    confidence: 0.92,
    ambiguities: [],
  };
}

function blockText(plans: PlanTurnBlocksResult[]): string {
  return plans
    .flatMap((plan) => plan.blocks)
    .map((block) => (block as { text?: string }).text ?? "")
    .join("\n");
}

function buildOrchestrator(
  intents: Record<string, unknown>,
  options: {
    compositionRejected?: boolean;
    legacyPlannerFails?: boolean;
    executiveFails?: boolean;
  } = {},
) {
  const planningContext = buildSafePlanningContext({
    userId: USER_ID,
    timezone: "America/Lima",
    channel: "dashboard",
    originalMessage: "conversacion",
    receivedAt: RECEIVED_AT,
    query: {
      kind: "unsupported",
      normalized_text: "conversacion",
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
      structure_proposal: intents.structure_proposal ?? null,
      memory_control: intents.memory_control ?? null,
      light_action: intents.light_action ?? null,
      profile_signal: intents.profile_signal ?? null,
      preference_change: intents.preference_change ?? null,
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
      findings: [],
      confidence: 0.8,
      safety_flags: [],
    },
    compilation: options.compositionRejected
      ? {
          accepted: false,
          issues: [
            {
              code: "claim_without_known_evidence",
              path: "response_composition.grounded_claims[0].evidence_refs",
              surface: "response_composition",
              message: "el copy cito evidencia desconocida",
            },
          ],
          dropped_action_intents: [],
        }
      : { accepted: true, issues: [], dropped_action_intents: [] },
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
      run: vi.fn(async () => {
        if (options.executiveFails) throw new Error("executive caido");
        return executiveResult;
      }),
    } as unknown as ConversationalExecutiveAgent,
    orchestrationPlanningAgent: {
      plan: vi.fn(async () => {
        if (options.legacyPlannerFails) {
          throw new Error("el planner legado no responde");
        }
        return {
          output: composeLocalOrchestrationPlan(planningContext),
          runtime: { provider: "local_fixture", latency_ms: 1 },
          tool_calls: [],
          safety: { policy_flags: [], redaction_applied: false },
        };
      }),
    } as unknown as OrchestrationPlanningAgent,
    dataAgent: {
      extract: vi.fn(async () => ({
        output: {
          intent: "conversation" as const,
          result: [],
          confidence: 0.9,
          requires_confirmation: false,
          ambiguities: [],
          safe_explanation: "sin acciones",
        },
        runtime: { provider: "test", latency_ms: 1 },
        safety: { policy_flags: [], redaction_applied: false },
      })),
    } as unknown as DataAgent,
    conversationAgent: {
      answer: vi.fn(async () => ({
        output: {
          response_text: "Te leo.",
          answer_kind: "clarification" as const,
          confidence: 0.9,
          cited_facts: [],
          used_tools: [],
          follow_up_question: null,
          safety_flags: [],
        },
        runtime: { provider: "local_deterministic", latency_ms: 1 },
        tool_calls: [],
        safety: { policy_flags: [], redaction_applied: false },
      })),
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
