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
import { buildPreferenceProposal } from "@/core/preferences/preference-executor";
import {
  buildPreferenceCommandText,
  PREFERENCE_CANCEL_COMMAND_ID,
} from "@/core/preferences/preference-proposal";
import type { PreferenceCommand } from "@/core/preferences/preference-request";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import { FinancialOrchestrator } from "./financial-orchestrator";

/**
 * `RUL-PREF-01` de punta a punta: pedir un cambio de preferencia hablando
 * **propone** y no escribe; el turno siguiente lo confirma y escribe una sola
 * vez; y un descarte no toca nada.
 *
 * Lo que este test protege es la mitad que se olvida: que "lo entendi" no se
 * convierta en "lo hice". Un asistente que dice que apago los avisos y no los
 * apaga se detecta al dia siguiente, y se paga con la confianza en todo lo
 * demas (`37` §14.3).
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
// La clave de hilo la deriva `resolveTurnThreadKey` del turno, no del estado.
const THREAD_KEY = `hilo:${THREAD_ID}`;
const RECEIVED_AT = "2026-08-10T10:00:00.000-05:00";

const hoisted = vi.hoisted(() => ({
  rpcCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  statusUpdates: [] as Array<Record<string, unknown>>,
  memoryState: null as unknown,
  upserts: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    id: "event-pref-1",
    source: "dashboard" as const,
    event_type: "assistant_turn",
    idempotency_key: "idem-pref-1",
    user_id: USER_ID,
    received_at: RECEIVED_AT,
    status: "received" as const,
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "trace-pref",
    metadata: { thread_id: THREAD_ID } as Record<string, unknown>,
    created_at: RECEIVED_AT,
    updated_at: RECEIVED_AT,
  })),
  updateExternalEventStatus: vi.fn(async (_client, input) => {
    hoisted.statusUpdates.push(input as Record<string, unknown>);
  }),
}));

vi.mock(
  "@/data/repositories/conversation-memory.repository",
  async (importOriginal) => {
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
  },
);

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.rpcCalls = [];
  hoisted.statusUpdates = [];
  hoisted.upserts = [];
  hoisted.memoryState = null;
});

describe("RUL-PREF-01: pedir un cambio de preferencia propone, no escribe", () => {
  it("“no me avises de los presupuestos” saca la tarjeta y no toca la base", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intent: "silenciar_tipo_recordatorio",
      activar: true,
      reminder_kind: "presupuesto_umbral",
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("no me avises de los presupuestos"),
    });

    expect(result.reason).toBe("accepted_with_preference_confirmation");
    // Nada escrito todavia: el catalogo dice `tarjeta`, y una tarjeta se
    // muestra antes de hacer nada.
    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(plans[0]?.blocks[0]?.kind).toBe("propuesta");
    expect(blockText(plans)).toContain("presupuestos cerca del límite");
  });

  it("la tarjeta de pausa lleva la fecha de reanudacion que exige `40` §7.14", async () => {
    const { orchestrator, plans } = buildOrchestrator({
      intent: "pausar_recordatorios",
      activar: true,
      pausar_dias: 7,
    });

    await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("no me molestes esta semana"),
    });

    expect(blockText(plans)).toContain("17 de agosto");
  });

  it("la tarjeta del correo declara el nivel `consentimiento` en el rastro", async () => {
    const { orchestrator } = buildOrchestrator({
      intent: "activar_correo_recordatorios",
      activar: true,
      reminder_kind: "cuota_proxima",
      confidence: 0.92,
    });

    await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("avísame por correo de las cuotas"),
    });

    const metadata = hoisted.statusUpdates.at(-1)?.metadata as Record<
      string,
      unknown
    >;
    expect(metadata.preference_action).toBe("activar_correo_recordatorios");
    expect(metadata.preference_level).toBe("consentimiento");
  });

  it("una duda declarada no propone nada y el turno sigue su camino", async () => {
    const { orchestrator } = buildOrchestrator({
      intent: "silenciar_tipo_recordatorio",
      activar: true,
      reminder_kind: "pago_proximo",
      ambiguities: ["¿de cuáles avisos habla?"],
    });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("deja de avisarme"),
    });

    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(result.status).toBe("accepted");
    expect(result.reason).not.toBe("accepted_with_preference_confirmation");
  });

  it("un turno sin preferencia no propone ni escribe nada", async () => {
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("¿cuánto gasté esta semana?"),
    });

    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(result.reason).not.toBe("accepted_with_preference_confirmation");
  });
});

describe("RUL-PREF-03: la confirmacion del turno siguiente es la que escribe", () => {
  it("pulsar el boton aplica el cambio una sola vez y lo dice", async () => {
    hoisted.memoryState = memoryStateWith({
      command: "silenciar_tipo_recordatorio",
      activar: true,
      tipo: "presupuesto_umbral",
    });
    const { orchestrator, plans } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput(buildPreferenceCommandText(PROPOSAL_ID)),
    });

    expect(result.reason).toBe("accepted_with_preference_applied");
    expect(hoisted.rpcCalls).toHaveLength(1);
    expect(hoisted.rpcCalls[0].name).toBe("set_reminder_preference_for_user");
    expect(hoisted.rpcCalls[0].args).toEqual({
      p_user_id: USER_ID,
      p_nudge_type: "presupuesto_umbral",
      p_channel: "dashboard",
      p_enabled: false,
    });
    expect(blockText(plans)).toMatch(/dejo de avisarte/i);
  });

  it("un «sí» escrito hace lo mismo que el botón", async () => {
    hoisted.memoryState = memoryStateWith({
      command: "pausar_recordatorios",
      activar: false,
    });
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("sí"),
    });

    expect(result.reason).toBe("accepted_with_preference_applied");
    expect(hoisted.rpcCalls[0].name).toBe("resume_reminders_for_user");
  });

  it("un «no» cancela y no escribe nada", async () => {
    hoisted.memoryState = memoryStateWith({
      command: "activar_correo_recordatorios",
      activar: true,
      tipo: "cuota_proxima",
    });
    const { orchestrator, plans } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("no, mejor no"),
    });

    expect(result.reason).toBe("accepted_with_preference_cancelled");
    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(blockText(plans)).toContain("no autorizaste nada");
  });

  it("pulsar el botón de cancelar tampoco escribe", async () => {
    hoisted.memoryState = memoryStateWith({
      command: "pausar_recordatorios",
      activar: true,
      dias: 7,
    });
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput(PREFERENCE_CANCEL_COMMAND_ID),
    });

    expect(result.reason).toBe("accepted_with_preference_cancelled");
    expect(hoisted.rpcCalls).toHaveLength(0);
  });

  it("un «no me avises» tras la tarjeta confirma, no cancela", async () => {
    // El fallo que este modulo viene a cerrar: la pregunta es negativa, y decir
    // que si a una pregunta negativa empieza por "no".
    hoisted.memoryState = memoryStateWith({
      command: "silenciar_tipo_recordatorio",
      activar: true,
      tipo: "pago_proximo",
    });
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("no me avises"),
    });

    expect(result.reason).toBe("accepted_with_preference_applied");
    expect(hoisted.rpcCalls[0].args.p_enabled).toBe(false);
  });

  it("una confirmación de otro hilo no ejecuta nada de este", async () => {
    hoisted.memoryState = memoryStateWith(
      { command: "pausar_recordatorios", activar: false },
      { threadKey: "otro-hilo" },
    );
    const { orchestrator } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("sí"),
    });

    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(result.reason).not.toBe("accepted_with_preference_applied");
  });

  it("una confirmación vencida se responde, no se ejecuta (`AC-RT-13`)", async () => {
    hoisted.memoryState = memoryStateWith(
      { command: "pausar_recordatorios", activar: false },
      { expiresAt: "2026-08-10T09:00:00.000-05:00" },
    );
    const { orchestrator, plans } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput("sí"),
    });

    expect(result.reason).toBe("accepted_with_preference_lapsed");
    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(blockText(plans)).toMatch(/llegó tarde/i);
  });

  it("un `pref:` inventado no encuentra borrador y no toca nada", async () => {
    hoisted.memoryState = memoryStateWith({
      command: "pausar_recordatorios",
      activar: false,
    });
    const { orchestrator, plans } = buildOrchestrator({ intent: "none" });

    const result = await orchestrator.handleTurn({
      externalEventId: "event-pref-1",
      traceId: "trace-pref",
      turnInput: turnInput(
        buildPreferenceCommandText("99999999-9999-4999-8999-999999999999"),
      ),
    });

    expect(result.reason).toBe("accepted_with_preference_lapsed");
    expect(hoisted.rpcCalls).toHaveLength(0);
    expect(plans[0]?.blocks.length).toBeGreaterThan(0);
  });
});

// --- Andamio ---------------------------------------------------------------

const PROPOSAL_ID = "11111111-1111-4111-8111-111111111111";

function memoryStateWith(
  command: PreferenceCommand,
  overrides: { threadKey?: string | null; expiresAt?: string | null } = {},
) {
  const built = buildPreferenceProposal({ command, now: RECEIVED_AT });
  if (!built) throw new Error("el borrador no valido");
  const proposal = { ...built, proposal_id: PROPOSAL_ID };

  return {
    id: "state-1",
    user_id: USER_ID,
    channel: "dashboard",
    thread_key: THREAD_KEY,
    last_intent: "preference_change",
    last_query_kind: null,
    last_query_text: null,
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary: proposal.summary,
    referenced_movements: [],
    referenced_entities: [],
    continuity_hint: null,
    expires_at: null,
    metadata: {},
    working_set: {
      version: "v1",
      topic: "support",
      goal: "confirm",
      last_user_message_summary: "no me avises",
      last_assistant_result_summary: proposal.summary,
      last_action: {
        kind: "preference_proposed",
        status: "awaiting_confirmation",
        source_ref: "event-pref-0",
        movement_ids: [],
        pending_item_ids: [],
        command_ids: [buildPreferenceCommandText(PROPOSAL_ID)],
        thread_key:
          overrides.threadKey === undefined ? THREAD_KEY : overrides.threadKey,
        confirmation_expires_at:
          overrides.expiresAt === undefined
            ? "2026-08-10T10:14:00.000-05:00"
            : overrides.expiresAt,
      },
      unresolved_slots: [],
      movement_referents: [],
      entity_referents: [],
      active_read_operation: null,
      preference_proposal: proposal as unknown as Record<string, unknown>,
      conversation_style: null,
      updated_at: RECEIVED_AT,
    },
  };
}

function blockText(plans: PlanTurnBlocksResult[]): string {
  return plans
    .flatMap((plan) => plan.blocks)
    .map((block) => (block as { text?: string }).text ?? "")
    .join("\n");
}

function buildOrchestrator(preferenceChange: {
  intent: string;
  activar?: boolean;
  reminder_kind?: string;
  pausar_dias?: number | null;
  desde_hora?: string | null;
  hasta_hora?: string | null;
  confidence?: number;
  ambiguities?: string[];
}) {
  const planningContext = buildSafePlanningContext({
    userId: USER_ID,
    timezone: "America/Lima",
    channel: "dashboard",
    originalMessage: "preferencia",
    receivedAt: RECEIVED_AT,
    query: {
      kind: "unsupported",
      normalized_text: "preferencia",
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
      profile_signal: null,
      preference_change: {
        intent: preferenceChange.intent,
        activar: preferenceChange.activar ?? true,
        reminder_kind: preferenceChange.reminder_kind ?? "",
        pausar_dias: preferenceChange.pausar_dias ?? null,
        desde_hora: preferenceChange.desde_hora ?? null,
        hasta_hora: preferenceChange.hasta_hora ?? null,
        confidence: preferenceChange.confidence ?? 0.93,
        ambiguities: preferenceChange.ambiguities ?? [],
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
  return {
    from: () => makeBuilder(),
    rpc: (name: string, args: Record<string, unknown>) => {
      hoisted.rpcCalls.push({ name, args });
      return Promise.resolve({ data: null, error: null });
    },
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
