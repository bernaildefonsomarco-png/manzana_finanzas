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
 * `AC-PERF-14` y `AC-PERF-02` de punta a punta: lo que la persona cuenta de si
 * misma se registra en el momento, se pregunta despues, y nunca a costa del
 * turno que el usuario vino a tener.
 *
 * Lo que estos tests protegen es la mitad que se rompe sola: que la respuesta
 * del usuario siga saliendo aunque el perfil falle. Un turno mudo por culpa de
 * una escritura opcional es peor que no aprender nada (`WEB-D296`).
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const STATE_ID = "11111111-1111-4111-8111-111111111111";
const CANDIDATE_ID = "22222222-2222-4222-8222-222222222222";
const RECEIVED_AT = "2026-08-11T10:00:00.000-05:00";

const hoisted = vi.hoisted(() => ({
  recordObservation: vi.fn(),
  listCandidates: vi.fn(),
  markAsked: vi.fn(),
  resolveCandidate: vi.fn(),
  listFacts: vi.fn(),
  getLearningPreferences: vi.fn(),
  activeState: null as unknown,
  statusUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/data/repositories/profile-candidates.repository", () => ({
  recordProfileCandidateObservation: hoisted.recordObservation,
  listOpenProfileCandidates: hoisted.listCandidates,
  listActiveProfileFacts: hoisted.listFacts,
  markProfileCandidateAsked: hoisted.markAsked,
  resolveProfileCandidateForUser: hoisted.resolveCandidate,
}));

vi.mock("@/data/repositories/financial-memory.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/financial-memory.repository")
  >();
  return { ...actual, getLearningPreferences: hoisted.getLearningPreferences };
});

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    id: "event-profile-1",
    source: "dashboard" as const,
    event_type: "assistant_turn",
    idempotency_key: "idem-profile-1",
    user_id: USER_ID,
    received_at: RECEIVED_AT,
    status: "received" as const,
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "trace-profile",
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
    getActiveConversationMemoryState: vi.fn(async () => hoisted.activeState),
    upsertConversationMemoryState: vi.fn(async () => null),
  };
});

function candidato(overrides: Record<string, unknown> = {}) {
  return {
    id: CANDIDATE_ID,
    subject_key: "vida:cobro",
    statement: "Cobras el 15 y el último día del mes",
    status: "observado",
    ask_count: 0,
    evidence_refs: ["evento:event-profile-1"],
    last_asked_at: null,
    metadata: { desbloquea: "poder decirte si llegas a fin de mes" },
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Estado conversacional vivo: sin el, todo turno seria el primero. */
function estadoActivo() {
  return {
    id: STATE_ID,
    user_id: USER_ID,
    channel: "dashboard",
    scope: "assistant",
    thread_key: THREAD_ID,
    last_intent: "conversation",
    last_query_kind: null,
    last_query_text: null,
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary: null,
    referenced_movements: [],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: null,
    expires_at: "2099-01-01T00:00:00.000Z",
    updated_at: RECEIVED_AT,
    metadata: {},
    working_set: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.statusUpdates = [];
  hoisted.activeState = estadoActivo();
  hoisted.listCandidates.mockResolvedValue([]);
  hoisted.listFacts.mockResolvedValue([]);
  hoisted.markAsked.mockResolvedValue(candidato({ status: "pending_confirmation" }));
  hoisted.recordObservation.mockResolvedValue({
    candidate: candidato(),
    reason: "created",
  });
  hoisted.resolveCandidate.mockResolvedValue({
    resolved: true,
    promotedFactId: "fact-1",
  });
  hoisted.getLearningPreferences.mockResolvedValue({
    user_id: USER_ID,
    enabled: true,
    allow_narrative_memory: true,
    allow_sensitive_memory: false,
    consent_version: "learning_v1",
    updated_by: "user",
    created_at: RECEIVED_AT,
    updated_at: RECEIVED_AT,
    metadata: {},
  });
});

describe("AC-PERF-14: lo que se cuenta al pasar se registra sin interrumpir", () => {
  it("un hecho de vida mencionado al pasar crea un candidato con su evidencia", async () => {
    const { orchestrator } = buildOrchestrator({
      profileSignal: {
        intent: "observed",
        subject_key: "vida:trabajo",
        statement: "Te acaban de ascender",
        origin: "dicho",
        unlocks: "ajustar tus proyecciones con tu nuevo ingreso",
        source_category_id: null,
        confidence: 0.92,
        ambiguities: [],
      },
    });

    await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("estoy con todo, me acaban de ascender"),
    });

    expect(hoisted.recordObservation).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: USER_ID,
        subjectKey: "vida:trabajo",
        evidenceRef: "evento:event-profile-1",
      }),
    );
  });

  it("con el aprendizaje apagado no se genera ni un candidato", async () => {
    hoisted.getLearningPreferences.mockResolvedValue({
      user_id: USER_ID,
      enabled: false,
      allow_narrative_memory: true,
      allow_sensitive_memory: false,
      consent_version: "learning_v1",
      updated_by: "user",
      created_at: RECEIVED_AT,
      updated_at: RECEIVED_AT,
      metadata: {},
    });
    const { orchestrator } = buildOrchestrator({
      profileSignal: {
        intent: "observed",
        subject_key: "vida:trabajo",
        statement: "Te acaban de ascender",
        origin: "dicho",
        unlocks: "ajustar tus proyecciones",
        source_category_id: null,
        confidence: 0.92,
        ambiguities: [],
      },
    });

    await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("me acaban de ascender"),
    });

    expect(hoisted.recordObservation).not.toHaveBeenCalled();
  });

  it("una señal de categoría sensible no llega ni a consultar el consentimiento", async () => {
    const { orchestrator } = buildOrchestrator({
      profileSignal: {
        intent: "observed",
        subject_key: "vida:rutina",
        statement: "Vas a terapia los martes",
        origin: "observado",
        unlocks: "entender ese gasto fijo",
        source_category_id: "salud",
        confidence: 0.95,
        ambiguities: [],
      },
    });

    await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("los martes tengo lo mío"),
    });

    expect(hoisted.recordObservation).not.toHaveBeenCalled();
  });
});

describe("AC-PERF-02: la pregunta sale detrás de la respuesta, nunca en su lugar", () => {
  it("añade la pregunta sin tocar el bloque que el usuario vino a buscar", async () => {
    hoisted.listCandidates.mockResolvedValue([candidato()]);
    const { orchestrator, plans } = buildOrchestrator({});

    await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("cómo va mi mes"),
    });

    const blocks = plans.at(-1)?.blocks ?? [];
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    expect(blocks[0]?.kind).toBe("texto");
    expect(blocks.at(-1)?.kind).toBe("pregunta");
    expect(hoisted.markAsked).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidateId: CANDIDATE_ID,
        conversationStateId: STATE_ID,
      }),
    );
  });

  it("no pregunta en el primer turno de la conversación", async () => {
    hoisted.activeState = null;
    hoisted.listCandidates.mockResolvedValue([candidato()]);
    const { orchestrator, plans } = buildOrchestrator({});

    await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("cómo va mi mes"),
    });

    const blocks = plans.at(-1)?.blocks ?? [];
    expect(blocks.some((block) => block.kind === "pregunta")).toBe(false);
    expect(hoisted.markAsked).not.toHaveBeenCalled();
  });

  it("un fallo del perfil no deja el turno mudo", async () => {
    hoisted.listCandidates.mockRejectedValue(new Error("PROFILE_READ_FAILED"));
    const { orchestrator, plans } = buildOrchestrator({});

    const result = await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("cómo va mi mes"),
    });

    expect(result.reason).toBe("accepted_with_conversation_response");
    const blocks = plans.at(-1)?.blocks ?? [];
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.some((block) => block.kind === "pregunta")).toBe(false);
  });
});

describe("AC-MEM-03: confirmar promueve el candidato a hecho", () => {
  it("“sí, es así” resuelve la pregunta que se acaba de hacer", async () => {
    hoisted.listCandidates.mockResolvedValue([
      candidato({
        status: "pending_confirmation",
        ask_count: 1,
        last_asked_at: RECEIVED_AT,
        metadata: {
          desbloquea: "poder decirte si llegas a fin de mes",
          asked_conversation_state_id: STATE_ID,
        },
      }),
    ]);
    const { orchestrator, plans } = buildOrchestrator({});

    const result = await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("sí, es así"),
    });

    expect(result.reason).toBe("accepted_with_profile_confirmation");
    expect(hoisted.resolveCandidate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        candidateId: CANDIDATE_ID,
        resolution: "confirm",
      }),
    );
    expect(plans.at(-1)?.blocks[0]?.kind).toBe("texto");
  });

  it("sin pregunta viva, un “sí” suelto no confirma nada", async () => {
    hoisted.listCandidates.mockResolvedValue([candidato()]);
    const { orchestrator } = buildOrchestrator({});

    const result = await orchestrator.handleTurn({
      externalEventId: "event-profile-1",
      traceId: "trace-profile",
      turnInput: turnInput("sí"),
    });

    // El "si" suelto sigue su camino de siempre (aqui, el de una confirmacion
    // sin pendiente). Lo que importa es que no toque el perfil: el candidato
    // existe, pero nadie le pregunto nada al usuario.
    expect(hoisted.resolveCandidate).not.toHaveBeenCalled();
    expect(result.reason).not.toBe("accepted_with_profile_confirmation");
  });
});

function buildOrchestrator(options: {
  profileSignal?: Record<string, unknown> | null;
}) {
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
      structure_proposal: null,
      memory_control: null,
      light_action: null,
      profile_signal: options.profileSignal ?? null,
      response_composition: {
        response_text: "Tu mes va bien.",
        answer_kind: "answer",
        confidence: 0.8,
        cited_facts: [],
        used_tools: [],
        follow_up_question: null,
        safety_flags: [],
        grounded_claims: [],
        composition_stage: "final_read_only",
      },
      confidence: 0.8,
      safety_flags: [],
    },
    runtime: {
      provider: "executive-test",
      model_name: "executive",
      latency_ms: 5,
    },
    compilation: { accepted: true, issues: [], dropped_action_intents: [] },
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
  return {
    from: () => makeBuilder(),
    rpc: async () => ({ data: null, error: null }),
  } as unknown as never;
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
