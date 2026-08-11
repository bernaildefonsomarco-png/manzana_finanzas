import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  quarantineActionIntents,
  withExecutiveSurfaces,
  type ConversationalExecutiveAgent,
  type ConversationalExecutiveOutput,
  type ConversationalExecutiveRunResult,
  type ExecutiveActionSurface,
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
 * `WEB-D297`: un reproche de la validacion sobre **como se dice** la respuesta
 * no puede hacer desaparecer en silencio una accion que la persona pidio.
 *
 * Antes de esto, el segundo rechazo del compilador lanzaba, el coordinador lo
 * atrapaba y las cinco ramas de accion recibian `null`. El turno contestaba
 * amable por el camino degradado y la orden no se hacia ni se mencionaba: la
 * persona leia algo cordial y creia que si. En una app de dinero eso es peor
 * que un error visible.
 *
 * Cada rama se prueba dos veces, y son casos opuestos a proposito:
 *
 * - reproche a la **redaccion** (`response_composition`): la accion se hace
 *   igual y el turno lo dice;
 * - reproche a **la accion misma** (su propio modulo): la accion no se hace
 *   —eso sigue valiendo— y el turno lo admite con su via manual, como
 *   `ERR-ASI-01` cuando no hay modelo.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const REMINDER_ID = "22222222-2222-4222-8222-222222222222";
const ACCOUNT_ID = "33333333-3333-4333-8333-333333333333";
const RECEIVED_AT = "2026-08-11T10:00:00.000-05:00";

const hoisted = vi.hoisted(() => ({
  dismissReminder: vi.fn(),
  snoozeReminder: vi.fn(),
  listFinancialMemory: vi.fn(),
  getLearningPreferences: vi.fn(),
  recordObservation: vi.fn(),
  listCandidates: vi.fn(),
  listFacts: vi.fn(),
  markAsked: vi.fn(),
  resolveCandidate: vi.fn(),
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
    listFinancialMemory: hoisted.listFinancialMemory,
    searchConfirmedFinancialMemory: vi.fn(async () => []),
  };
});

vi.mock("@/data/repositories/profile-candidates.repository", () => ({
  recordProfileCandidateObservation: hoisted.recordObservation,
  listOpenProfileCandidates: hoisted.listCandidates,
  listActiveProfileFacts: hoisted.listFacts,
  markProfileCandidateAsked: hoisted.markAsked,
  resolveProfileCandidateForUser: hoisted.resolveCandidate,
}));

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    id: "event-rejected-1",
    source: "dashboard" as const,
    event_type: "assistant_turn",
    idempotency_key: "idem-rejected-1",
    user_id: USER_ID,
    received_at: RECEIVED_AT,
    status: "received" as const,
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "trace-rejected",
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
  hoisted.recordObservation.mockResolvedValue(undefined);
  hoisted.listCandidates.mockResolvedValue([]);
  hoisted.listFacts.mockResolvedValue([]);
  hoisted.statusUpdates = [];
});

describe("WEB-D297: un reproche a la redaccion no borra la accion pedida", () => {
  it("memoria: la orden se ejecuta igual y el turno la responde", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { memory_control: memoryControlIntent() },
      rejectedPaths: ["response_composition.grounded_claims[0].evidence_refs"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("¿qué te acordás de mí?"),
    });

    expect(result.reason).toBe("accepted_with_memory_control");
    expect(hoisted.listFinancialMemory).toHaveBeenCalled();
    expect(blockText(plans)).not.toBe("");
  });

  it("accion ligera: el recordatorio se descarta de verdad y se dice", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { light_action: lightActionIntent() },
      rejectedPaths: ["response_composition.grounded_claims[0].evidence_refs"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(result.reason).toBe("accepted_with_light_action_applied");
    expect(hoisted.dismissReminder).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      REMINDER_ID,
    );
    expect(blockText(plans)).toMatch(/no cambié ningún movimiento ni saldo/i);
  });

  it("preferencias: sale la tarjeta que hay que confirmar, no un texto amable", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { preference_change: preferenceChangeIntent() },
      rejectedPaths: ["response_composition.response_text"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("pausá mis recordatorios hasta el lunes"),
    });

    expect(result.reason).toBe("accepted_with_preference_confirmation");
    // Sigue exigiendo confirmacion: rescatar la intencion nunca la ejecuta.
    expect(plans[0]?.blocks[0]?.kind).toBe("propuesta");
    expect(blockText(plans)).not.toBe("");
  });

  it("estructura: sale la propuesta de caja que hay que confirmar", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { structure_proposal: structureProposalIntent() },
      rejectedPaths: ["response_composition.grounded_claims[0].source_tools"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("apartame 500 para el viaje"),
    });

    expect(result.reason).toBe("accepted_with_structure_confirmation");
    expect(plans[0]?.blocks[0]?.kind).toBe("propuesta");
  });

  it("perfil: lo que la persona conto de si misma se sigue registrando", async () => {
    const { orchestrator } = buildOrchestrator({
      intents: { profile_signal: profileSignalIntent() },
      rejectedPaths: ["response_composition.grounded_claims[0].evidence_refs"],
    });

    await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("me pagan el 15 y a fin de mes"),
    });

    expect(hoisted.recordObservation).toHaveBeenCalled();
  });
});

describe("WEB-D297: un reproche a la accion misma la sigue rechazando", () => {
  it("memoria: no se toca nada y el turno lo admite con via manual", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { memory_control: memoryControlIntent() },
      rejectedPaths: ["memory_control.intent"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("¿qué te acordás de mí?"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(hoisted.listFinancialMemory).not.toHaveBeenCalled();
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
    expect(blockText(plans)).toMatch(/no cambié nada/i);
  });

  it("accion ligera: el recordatorio no se toca y el turno lo dice", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { light_action: lightActionIntent() },
      rejectedPaths: ["light_action.target_id"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
  });

  it("preferencias: no sale ninguna tarjeta que prometa el cambio", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { preference_change: preferenceChangeIntent() },
      rejectedPaths: ["preference_change.intent"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("pausá mis recordatorios hasta el lunes"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
  });

  it("estructura: no sale ninguna propuesta de caja", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intents: { structure_proposal: structureProposalIntent() },
      rejectedPaths: ["structure_proposal.entity"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("apartame 500 para el viaje"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(plans[0]?.blocks[0]?.kind).toBe("limite");
  });

  it("perfil: no se registra nada y tampoco se le anuncia a la persona", async () => {
    const { orchestrator } = buildOrchestrator({
      intents: { profile_signal: profileSignalIntent() },
      rejectedPaths: ["profile_signal.subject_key"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("me pagan el 15 y a fin de mes"),
    });

    // Lo que el motor cree notar sobre alguien no es un pedido suyo: anunciar
    // que no se guardo seria contarle lo que iba a deducir a sus espaldas.
    expect(hoisted.recordObservation).not.toHaveBeenCalled();
    expect(result.reason).not.toBe("accepted_with_action_not_honored");
  });

  it("una ruta que el mapa no sabe clasificar cierra las cinco intenciones", async () => {
    const { orchestrator } = buildOrchestrator({
      intents: { light_action: lightActionIntent() },
      rejectedPaths: ["modulo_que_todavia_no_existe.campo"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-rejected-1",
      traceId: "trace-rejected",
      turnInput: turnInput("quita ese recordatorio"),
    });

    expect(result.reason).toBe("accepted_with_action_not_honored");
    expect(hoisted.dismissReminder).not.toHaveBeenCalled();
  });
});

function memoryControlIntent() {
  return {
    intent: "list",
    target: "",
    replacement: "",
    confidence: 0.9,
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

function preferenceChangeIntent() {
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

function structureProposalIntent() {
  return {
    intent: "create",
    entity: "caja",
    summary: "¿Creo la caja Viaje y aparto S/500?",
    confirm_label: "Sí, crea la caja",
    confidence: 0.94,
    ambiguities: [],
    target_id: null,
    name: "Viaje",
    amount: 500,
    target_amount: null,
    target_date: null,
    account_id: ACCOUNT_ID,
    box_id: null,
    box_type: null,
    category_id: null,
    period_kind: null,
    budget_kind: null,
    frequency: null,
    next_expected_date: null,
    amount_variability: null,
    currency: "PEN",
    account_type: null,
    institution: null,
  };
}

function profileSignalIntent() {
  return {
    intent: "observed",
    subject_key: "vida:cobro",
    statement: "Cobras el 15 y el último día del mes",
    origin: "dicho",
    unlocks: "poder decirte si llegas a fin de mes",
    source_category_id: null,
    confidence: 0.9,
    ambiguities: [],
  };
}

function blockText(plans: PlanTurnBlocksResult[]): string {
  return plans
    .flatMap((plan) => plan.blocks)
    .map((block) => (block as { text?: string }).text ?? "")
    .join("\n");
}

/**
 * Un ejecutivo cuya composicion fue rechazada, con las intenciones que se le
 * pidan. `rejectedPaths` es lo unico que cambia entre los dos grupos de tests:
 * a que modulo apunta el reproche.
 */
function buildOrchestrator(options: {
  intents: Partial<Record<ExecutiveActionSurface, unknown>>;
  rejectedPaths: string[];
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

  const issues = withExecutiveSurfaces(
    options.rejectedPaths.map((path) => ({
      code: "claim_without_known_evidence" as const,
      path,
      message: `reproche de prueba en ${path}`,
    })),
  );

  const rawOutput = {
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
      structure_proposal: options.intents.structure_proposal ?? null,
      memory_control: options.intents.memory_control ?? null,
      light_action: options.intents.light_action ?? null,
      profile_signal: options.intents.profile_signal ?? null,
      preference_change: options.intents.preference_change ?? null,
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
    } as unknown as ConversationalExecutiveOutput;

  // La cuarentena la aplica la funcion real del agente, no una copia del test:
  // si la regla de que sobrevive cambiara, estos tests lo notan.
  const { output, dropped } = quarantineActionIntents(rawOutput, issues);

  const executiveResult = {
    output,
    compilation: {
      accepted: false,
      issues,
      dropped_action_intents: dropped,
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
    // Una composicion rechazada degrada al planner legado: es el mismo camino
    // que cuando el ejecutivo falla entero, sin pasadas de modelo nuevas.
    orchestrationPlanningAgent: {
      plan: vi.fn(async () => ({
        output: composeLocalOrchestrationPlan(planningContext),
        runtime: { provider: "local_fixture", latency_ms: 1 },
        tool_calls: [],
        safety: { policy_flags: [], redaction_applied: false },
      })),
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
