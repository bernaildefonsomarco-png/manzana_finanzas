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
 * `RUL-MEM-16` de punta a punta: la intencion de control de memoria la
 * determina el juicio del modelo, no una lista de frases exactas.
 *
 * Antes de esto, "¿que te acordas de mi?" y "che, olvidate de eso" no
 * matcheaban ninguna expresion regular, y el fallo era asimetrico: `list`
 * degradaba al modelo, pero `forget`, `correct`, `enable` y `disable` caian a
 * una ruta **sin ejecutor**. El asistente respondia amablemente y no olvidaba
 * nada.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const MEMORY_ID = "22222222-2222-4222-8222-222222222222";
const OTHER_MEMORY_ID = "33333333-3333-4333-8333-333333333333";
const RECEIVED_AT = "2026-08-09T10:00:00.000-05:00";

const hoisted = vi.hoisted(() => ({
  memories: [] as Array<Record<string, unknown>>,
  preferences: {
    enabled: true,
    allow_narrative_memory: true,
    allow_sensitive_memory: false,
  } as Record<string, unknown>,
  manage: vi.fn(),
  setPreferences: vi.fn(),
  listThrows: false,
  memoryState: null as unknown,
  upserts: [] as Array<Record<string, unknown>>,
  statusUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/data/repositories/financial-memory.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/financial-memory.repository")
  >();
  return {
    ...actual,
    getLearningPreferences: vi.fn(async () => hoisted.preferences),
    listFinancialMemory: vi.fn(async () => {
      if (hoisted.listThrows) throw new Error("memoria caida");
      return hoisted.memories;
    }),
    manageFinancialMemory: hoisted.manage,
    setLearningPreferences: hoisted.setPreferences,
    searchConfirmedFinancialMemory: vi.fn(async () => []),
  };
});

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    id: "event-memory-1",
    source: "dashboard" as const,
    event_type: "assistant_turn",
    idempotency_key: "idem-memory-1",
    user_id: USER_ID,
    received_at: RECEIVED_AT,
    status: "received" as const,
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "trace-memory",
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
    getActiveConversationMemoryState: vi.fn(async () => hoisted.memoryState),
    upsertConversationMemoryState: vi.fn(async (_client, input) => {
      hoisted.upserts.push(input as Record<string, unknown>);
      return null;
    }),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.memories = [memoryRow()];
  hoisted.preferences = {
    enabled: true,
    allow_narrative_memory: true,
    allow_sensitive_memory: false,
  };
  hoisted.manage.mockResolvedValue({ memory: memoryRow(), replacement: null });
  hoisted.setPreferences.mockResolvedValue({});
  hoisted.listThrows = false;
  hoisted.memoryState = null;
  hoisted.upserts = [];
  hoisted.statusUpdates = [];
});

describe("la intencion de memoria la decide el modelo", () => {
  it("“¿qué te acordás de mí?” lista los recuerdos con sus códigos", async () => {
    const { orchestrator, plans } = buildOrchestrator({ intent: "list" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("¿qué te acordás de mí?"),
    });

    expect(result.reason).toBe("accepted_with_memory_control");
    expect(blockText(plans)).toContain("M-22222222");
  });

  it("“che, olvidate de eso” propone olvidar, con tarjeta y botones", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intent: "forget",
      target: "eso",
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("che, olvidate de eso"),
    });

    expect(result.reason).toBe("accepted_with_memory_confirmation");
    // `40` §7.13: `olvidar_aprendizaje` es nivel `tarjeta`. Nada se ejecuta
    // en el mismo turno en que se pide.
    expect(hoisted.manage).not.toHaveBeenCalled();
    const [block] = plans[0]?.blocks ?? [];
    expect(block?.kind).toBe("propuesta");
    expect(blockText(plans)).toContain("No cambia ningún movimiento");

    // El borrador queda sellado con hilo y vigencia, o el "sí" siguiente no
    // encontraria nada que ejecutar.
    const workingSet = lastWorkingSet();
    expect(workingSet?.memory_proposal).toBeTruthy();
    expect(workingSet?.last_action).toMatchObject({
      kind: "memory_proposed",
      status: "awaiting_confirmation",
      thread_key: `hilo:${THREAD_ID}`,
    });
  });

  it("“ya no me digas Marquito, decime Marco” propone la corrección", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intent: "correct",
      target: "breves",
      replacement: "ahora prefiero respuestas detalladas",
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("ya no es así, ahora prefiero que me expliques todo"),
    });

    expect(result.reason).toBe("accepted_with_memory_confirmation");
    expect(hoisted.manage).not.toHaveBeenCalled();
    // `40` §7.13: el detalle de `corregir_aprendizaje` es lo anterior y lo nuevo.
    expect(blockText(plans)).toContain("Prefiero respuestas breves");
    expect(blockText(plans)).toContain("ahora prefiero respuestas detalladas");
  });

  it("“no aprendas más de mí” apaga el aprendizaje de verdad", async () => {
    const { orchestrator } = buildOrchestrator({ intent: "disable" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("no aprendas más de mí, por favor"),
    });

    expect(result.reason).toBe("accepted_with_memory_control");
    expect(hoisted.setPreferences).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: false }),
    );
  });

  it("“volvé a acordarte de mis cosas” lo vuelve a encender", async () => {
    hoisted.preferences = {
      enabled: false,
      allow_narrative_memory: true,
      allow_sensitive_memory: false,
    };
    const { orchestrator } = buildOrchestrator({ intent: "enable" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("volvé a acordarte de mis cosas"),
    });

    expect(result.reason).toBe("accepted_with_memory_control");
    expect(hoisted.setPreferences).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ enabled: true }),
    );
  });

  it("con varios candidatos pregunta por código y no borra el que no era", async () => {
    hoisted.memories = [
      memoryRow(),
      memoryRow({
        id: OTHER_MEMORY_ID,
        summary: "Prefiero respuestas breves por la mañana",
      }),
    ];
    const { orchestrator, plans } = buildOrchestrator({
      intent: "forget",
      target: "",
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("olvidate de eso"),
    });

    expect(result.reason).toBe("accepted_with_memory_control");
    expect(hoisted.manage).not.toHaveBeenCalled();
    expect(blockText(plans)).toContain("M-22222222");
    expect(blockText(plans)).toContain("M-33333333");
    expect(lastWorkingSet()?.memory_proposal).toBeNull();
  });

  it("con el aprendizaje apagado la lista lo dice y no inventa nada", async () => {
    hoisted.preferences = {
      enabled: false,
      allow_narrative_memory: true,
      allow_sensitive_memory: false,
    };
    const { orchestrator, plans } = buildOrchestrator({ intent: "list" });

    await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("¿qué sabés de mí ahora mismo?"),
    });

    expect(blockText(plans)).toContain("aprendizaje está desactivado");
  });

  it("“borrá todo lo que sabés de mí” se rechaza y da la vía de pantalla", async () => {
    const { orchestrator, plans } = buildOrchestrator({ intent: "forget_all" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("borrá todo lo que sabés de mí"),
    });

    // `WEB-D065` / `40` §8.2: el motor no puede borrar toda la memoria.
    expect(result.reason).toBe("accepted_with_memory_control");
    expect(hoisted.manage).not.toHaveBeenCalled();
    expect(blockText(plans)).toContain("pantalla de Memoria");
  });

  it("un fallo de la memoria no deja el turno mudo", async () => {
    hoisted.listThrows = true;
    const { orchestrator, plans } = buildOrchestrator({
      intent: "forget",
      target: "eso",
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("olvidate de eso"),
    });

    // Cae al camino normal en vez de romper, y ese camino sí dice algo.
    expect(result.status).toBe("accepted");
    expect(plans.at(-1)?.blocks.length).toBeGreaterThan(0);
    expect(hoisted.manage).not.toHaveBeenCalled();
  });
});

describe("confirmar la orden de memoria propuesta", () => {
  it("un “sí, olvidalo” del mismo hilo la ejecuta y limpia el borrador", async () => {
    hoisted.memoryState = memoryStateWithProposal();
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("sí, olvidalo"),
    });

    expect(result.reason).toBe("accepted_with_memory_applied");
    expect(hoisted.manage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "forget",
        memoryId: MEMORY_ID,
        idempotencyKey: `memory-control:memory:${PROPOSAL_ID}`,
      }),
    );
    expect(lastWorkingSet()?.memory_proposal).toBeNull();
  });

  it("pulsar el botón ejecuta exactamente lo mismo", async () => {
    hoisted.memoryState = memoryStateWithProposal();
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput(`mem:${PROPOSAL_ID}`),
    });

    expect(result.reason).toBe("accepted_with_memory_applied");
    expect(hoisted.manage).toHaveBeenCalledTimes(1);
  });

  it("un “no, dejalo” cancela sin tocar el recuerdo", async () => {
    hoisted.memoryState = memoryStateWithProposal();
    const { orchestrator, plans } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("no, dejalo"),
    });

    expect(result.reason).toBe("accepted_with_memory_cancelled");
    expect(hoisted.manage).not.toHaveBeenCalled();
    expect(blockText(plans)).toContain("no olvidé nada");
  });

  it("una confirmación de otra conversación no borra nada", async () => {
    hoisted.memoryState = memoryStateWithProposal({ threadKey: "hilo:otro" });
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("sí, olvidalo"),
    });

    expect(result.reason).not.toBe("accepted_with_memory_applied");
    expect(hoisted.manage).not.toHaveBeenCalled();
  });

  it("una confirmación fuera de la vigencia se responde, no se ejecuta", async () => {
    hoisted.memoryState = memoryStateWithProposal({
      expiresAt: "2026-08-09T09:00:00.000-05:00",
    });
    const { orchestrator, plans } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-memory-1",
      traceId: "trace-memory",
      turnInput: turnInput("sí, olvidalo"),
    });

    expect(result.reason).toBe("accepted_with_memory_lapsed");
    expect(hoisted.manage).not.toHaveBeenCalled();
    expect(blockText(plans)).toContain("llegó tarde");
  });
});

const PROPOSAL_ID = "44444444-4444-4444-8444-444444444444";

function memoryProposalPayload() {
  return {
    proposal_id: PROPOSAL_ID,
    action: "forget",
    memory_id: MEMORY_ID,
    memory_code: "M-22222222",
    summary: "¿Olvido M-22222222 · Prefiero respuestas breves?",
    confirm_label: "Sí, olvídalo",
    replacement: null,
    proposed_at: "2026-08-09T09:59:00.000-05:00",
  };
}

function memoryStateWithProposal(
  overrides: { threadKey?: string; expiresAt?: string } = {},
) {
  return {
    id: "state-memory-1",
    user_id: USER_ID,
    channel: "dashboard" as const,
    scope: "default",
    thread_key: overrides.threadKey ?? `hilo:${THREAD_ID}`,
    last_intent: "memory_control",
    last_query_kind: null,
    last_query_text: "olvidate de eso",
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary: "¿Olvido M-22222222?",
    referenced_movements: [],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: "event-memory-1",
    expires_at: "2026-08-09T12:00:00.000-05:00",
    created_at: "2026-08-09T09:59:00.000-05:00",
    updated_at: "2026-08-09T09:59:00.000-05:00",
    metadata: {},
    working_set: {
      version: "v1" as const,
      topic: "memory" as const,
      goal: "confirm" as const,
      last_user_message_summary: "olvidate de eso",
      last_assistant_result_summary: "¿Olvido M-22222222?",
      last_action: {
        kind: "memory_proposed" as const,
        status: "awaiting_confirmation" as const,
        source_ref: "event-memory-1",
        movement_ids: [],
        pending_item_ids: [],
        command_ids: [`mem:${PROPOSAL_ID}`],
        thread_key: overrides.threadKey ?? `hilo:${THREAD_ID}`,
        confirmation_expires_at:
          overrides.expiresAt ?? "2026-08-09T10:14:00.000-05:00",
      },
      unresolved_slots: [],
      movement_referents: [],
      entity_referents: [],
      active_read_operation: null,
      focus_set: null,
      structure_proposal: null,
      memory_proposal: memoryProposalPayload(),
      conversation_style: null,
      updated_at: "2026-08-09T09:59:00.000-05:00",
    },
  };
}

function lastWorkingSet(): Record<string, unknown> | undefined {
  const last = hoisted.upserts.at(-1);
  return (last?.metadata as { working_set?: Record<string, unknown> })
    ?.working_set;
}

function blockText(plans: PlanTurnBlocksResult[]): string {
  return plans
    .flatMap((plan) => plan.blocks)
    .map((block) => ("text" in block ? block.text : ""))
    .join("\n");
}

function buildOrchestrator(memoryControl: {
  intent: string;
  target?: string;
  replacement?: string;
}) {
  const planningContext = buildSafePlanningContext({
    userId: USER_ID,
    timezone: "America/Lima",
    channel: "dashboard",
    originalMessage: "memoria",
    receivedAt: RECEIVED_AT,
    query: {
      kind: "unsupported",
      normalized_text: "memoria",
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
      reference_resolution: {
        resolution: "not_applicable",
        focus_id: null,
        candidate_movement_ids: [],
        candidate_entity_ids: [],
        visible_order_ids: [],
        confidence: 0.5,
        ambiguities: [],
        evidence_refs: [],
      },
      financial_proposals: {
        intent: "conversation",
        result: [],
        confidence: 0.8,
        requires_confirmation: false,
        ambiguities: [],
      },
      correction_proposal: {
        is_correction: false,
        command_id: null,
        operation: "none",
        correction_type: "none",
        candidate_movement_ids: [],
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
      memory_control: {
        intent: memoryControl.intent,
        target: memoryControl.target ?? "",
        replacement: memoryControl.replacement ?? "",
        confidence: 0.92,
        ambiguities: [],
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

function memoryRow(patch: Record<string, unknown> = {}) {
  return {
    id: MEMORY_ID,
    user_id: USER_ID,
    kind: "preference",
    canonical_key: "preference:conversation_style",
    summary: "Prefiero respuestas breves",
    search_terms: ["respuestas", "breves"],
    evidence_source: "explicit_user_statement",
    evidence_ref: "turn-1",
    confidence: 1,
    confirmation_status: "confirmed",
    lifecycle_status: "confirmed",
    sensitivity: "normal",
    valid_until: null,
    superseded_at: null,
    positive_evidence_refs: ["turn-1"],
    negative_evidence_refs: [],
    positive_evidence_count: 1,
    negative_evidence_count: 0,
    explanation: "Confirmado por el usuario.",
    review_at: null,
    last_used_at: null,
    suspended_at: null,
    revoked_at: null,
    revoked_reason: null,
    sensitive_confirmed_at: null,
    source_candidate_id: "candidate-1",
    supersedes_memory_id: null,
    created_at: "2026-07-24T10:00:00.000Z",
    updated_at: "2026-07-24T10:00:00.000Z",
    metadata: {},
    ...patch,
  };
}
