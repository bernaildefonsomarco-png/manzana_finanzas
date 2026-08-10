import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationAgent } from "@/agents/conversation-agent";
import type { DataAgent } from "@/agents/data-agent";
import type { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import type { PresentedTurn, TurnInput } from "@/core/channel/types";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import { FinancialOrchestrator } from "./financial-orchestrator";

/**
 * `RUL-ESTR-03` de punta a punta: una propuesta de caja solo se ejecuta cuando
 * el usuario la confirma, en su mismo hilo y dentro de la vigencia. Un doble
 * envio no crea dos cajas, y una confirmacion de otra conversacion no toca
 * nada.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000031";
const BOX_ID = "00000000-0000-4000-8000-000000000041";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const OTHER_THREAD_ID = "00000000-0000-4000-8000-0000000000bb";
const THREAD_KEY = `hilo:${THREAD_ID}`;
const RECEIVED_AT = "2026-08-09T10:00:30.000-05:00";

const hoisted = vi.hoisted(() => ({
  executeStructureCommand: vi.fn(),
  memoryState: null as unknown,
  eventMetadata: { thread_id: "00000000-0000-4000-8000-0000000000aa" } as Record<
    string,
    unknown
  >,
  receivedAt: "2026-08-09T10:00:30.000-05:00",
  upserts: [] as Array<Record<string, unknown>>,
  statusUpdates: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/core/structure/structure-executor", () => ({
  executeStructureCommand: hoisted.executeStructureCommand,
}));

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    id: "event-structure-1",
    source: "dashboard" as const,
    event_type: "assistant_turn",
    idempotency_key: "idem-structure-1",
    user_id: USER_ID,
    received_at: hoisted.receivedAt,
    status: "received" as const,
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "trace-structure",
    metadata: hoisted.eventMetadata,
    created_at: hoisted.receivedAt,
    updated_at: hoisted.receivedAt,
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

function structureProposalPayload() {
  return {
    proposal_id: PROPOSAL_ID,
    entity: "caja",
    operation: "create",
    command_type: "CreateBoxCommand",
    payload: {
      name: "Viaje",
      account_id: ACCOUNT_ID,
      type: "objetivo",
      initial_balance: 500,
      target_amount: null,
      target_date: null,
    },
    summary: "¿Creo la caja Viaje y aparto S/500?",
    confirm_label: "Sí, crear la caja",
    proposed_at: "2026-08-09T10:00:00.000-05:00",
  };
}

function memoryStateWithProposedBox(
  overrides: { threadKey?: string | null; expiresAt?: string | null } = {},
) {
  return {
    id: "state-1",
    user_id: USER_ID,
    channel: "dashboard" as const,
    scope: "default",
    thread_key:
      overrides.threadKey === undefined ? THREAD_KEY : overrides.threadKey ?? "",
    last_intent: "structure",
    last_query_kind: null,
    last_query_text: "apartame 500 para el viaje",
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary: "¿Creo la caja Viaje y aparto S/500?",
    referenced_movements: [],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: "event-structure-1",
    expires_at: "2026-08-09T12:00:00.000-05:00",
    created_at: "2026-08-09T10:00:00.000-05:00",
    updated_at: "2026-08-09T10:00:00.000-05:00",
    metadata: {},
    working_set: {
      version: "v1" as const,
      topic: "balance" as const,
      goal: "confirm" as const,
      last_user_message_summary: "apartame 500 para el viaje",
      last_assistant_result_summary: "¿Creo la caja Viaje y aparto S/500?",
      last_action: {
        kind: "structure_proposed" as const,
        status: "awaiting_confirmation" as const,
        source_ref: "event-structure-1",
        movement_ids: [],
        pending_item_ids: [],
        command_ids: [`estr:${PROPOSAL_ID}`],
        thread_key:
          overrides.threadKey === undefined ? THREAD_KEY : overrides.threadKey,
        confirmation_expires_at:
          overrides.expiresAt === undefined
            ? "2026-08-09T10:15:00.000-05:00"
            : overrides.expiresAt,
      },
      unresolved_slots: [],
      movement_referents: [],
      entity_referents: [],
      active_read_operation: null,
      focus_set: null,
      structure_proposal: structureProposalPayload(),
      conversation_style: null,
      updated_at: "2026-08-09T10:00:00.000-05:00",
    },
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

/** Agentes que no proponen nada: el turno tiene que resolverse por estructura. */
function quietAgents() {
  return {
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
        runtime: {
          provider: "local_deterministic" as const,
          model_name: "test",
          latency_ms: 1,
        },
        tool_calls: [],
        safety: { policy_flags: [], redaction_applied: false },
      })),
    } as unknown as ConversationAgent,
    orchestrationPlanningAgent: {
      plan: vi.fn(async () => {
        throw new Error("sin planificador en esta prueba");
      }),
    } as unknown as OrchestrationPlanningAgent,
  };
}

function turnInput(text: string): TurnInput {
  return {
    actor: "user",
    text,
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "dashboard",
  };
}

function buildOrchestrator(plans: PlanTurnBlocksResult[]) {
  return new FinancialOrchestrator(createGenericSupabaseClient(), {
    ...quietAgents(),
    conversationalExecutiveMode: "off",
    presentTurn: async (plan) => {
      plans.push(plan);
      return fakePresentedTurn();
    },
  });
}

beforeEach(() => {
  hoisted.executeStructureCommand.mockReset();
  hoisted.executeStructureCommand.mockResolvedValue({
    kind: "applied",
    entity: "caja",
    operation: "create",
    entity_id: BOX_ID,
    summary: "la caja Viaje con S/500.00 apartados",
    idempotent: false,
  });
  hoisted.memoryState = memoryStateWithProposedBox();
  hoisted.eventMetadata = { thread_id: THREAD_ID };
  hoisted.receivedAt = RECEIVED_AT;
  hoisted.upserts = [];
  hoisted.statusUpdates = [];
});

describe("confirmar una caja propuesta", () => {
  it("un 'sí' del mismo hilo la crea y limpia el borrador", async () => {
    const plans: PlanTurnBlocksResult[] = [];
    const result = await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput("si"),
      traceId: "trace-structure",
    });

    expect(result.reason).toBe("accepted_with_structure_applied");
    expect(hoisted.executeStructureCommand).toHaveBeenCalledTimes(1);

    const [call] = hoisted.executeStructureCommand.mock.calls;
    expect(call[0].command).toMatchObject({
      type: "CreateBoxCommand",
      user_id: USER_ID,
      idempotency_key: `structure:${PROPOSAL_ID}`,
      payload: { name: "Viaje", account_id: ACCOUNT_ID },
    });

    // El borrador desaparece: un "si" posterior ya no crea otra caja.
    const ultimo = hoisted.upserts.at(-1);
    const workingSet = (
      ultimo?.metadata as { working_set?: Record<string, unknown> }
    )?.working_set;
    expect(workingSet?.structure_proposal).toBeNull();
    expect(workingSet?.last_action).toMatchObject({
      kind: "structure_applied",
      status: "completed",
    });

    expect(plans[0]?.reason).toBe("structure_applied");
  });

  it("pulsar el botón ejecuta exactamente el mismo comando", async () => {
    const plans: PlanTurnBlocksResult[] = [];
    const result = await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput(`estr:${PROPOSAL_ID}`),
      traceId: "trace-structure",
    });

    expect(result.reason).toBe("accepted_with_structure_applied");
    expect(
      hoisted.executeStructureCommand.mock.calls[0][0].command
        .idempotency_key,
    ).toBe(`structure:${PROPOSAL_ID}`);
  });

  it("un segundo envío no crea una segunda caja", async () => {
    hoisted.executeStructureCommand.mockResolvedValue({
      kind: "applied",
      entity: "caja",
      operation: "create",
      entity_id: BOX_ID,
      summary: "la caja Viaje con S/500.00 apartados",
      idempotent: true,
    });

    const plans: PlanTurnBlocksResult[] = [];
    const result = await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput(`estr:${PROPOSAL_ID}`),
      traceId: "trace-structure",
    });

    expect(result.reason).toBe("accepted_with_structure_applied");
    const [update] = hoisted.statusUpdates;
    expect(update.metadata).toMatchObject({
      structure_resolution_idempotent: true,
      structure_resolution_entity_id: BOX_ID,
    });
  });
});

describe("nada se escribe sin confirmación", () => {
  it("un 'no' cancela y no ejecuta nada", async () => {
    const plans: PlanTurnBlocksResult[] = [];
    const result = await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput("cancelar"),
      traceId: "trace-structure",
    });

    expect(result.reason).toBe("accepted_with_structure_cancelled");
    expect(hoisted.executeStructureCommand).not.toHaveBeenCalled();
    expect(plans[0]?.reason).toBe("structure_cancelled");
  });

  it("un 'sí' de otra conversación no crea la caja del hilo ajeno", async () => {
    hoisted.eventMetadata = { thread_id: OTHER_THREAD_ID };

    const plans: PlanTurnBlocksResult[] = [];
    const result = await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput("si"),
      traceId: "trace-structure",
    });

    expect(hoisted.executeStructureCommand).not.toHaveBeenCalled();
    expect(result.reason).not.toBe("accepted_with_structure_applied");
  });

  it("un 'sí' fuera de la ventana de vigencia se responde, no se ejecuta", async () => {
    hoisted.receivedAt = "2026-08-09T10:30:00.000-05:00";

    const plans: PlanTurnBlocksResult[] = [];
    const result = await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput("si"),
      traceId: "trace-structure",
    });

    expect(result.reason).toBe("accepted_with_structure_lapsed");
    expect(hoisted.executeStructureCommand).not.toHaveBeenCalled();
    expect(plans[0]?.reason).toBe("structure_failed");
  });

  it("cambiar de tema caduca la propuesta en vez de dejarla armada", async () => {
    const plans: PlanTurnBlocksResult[] = [];
    await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput("cuanto gaste ayer"),
      traceId: "trace-structure",
    });

    expect(hoisted.executeStructureCommand).not.toHaveBeenCalled();
    const caducado = hoisted.upserts.find((upsert) => {
      const workingSet = (
        upsert.metadata as { working_set?: Record<string, unknown> }
      )?.working_set;
      const lastAction = workingSet?.last_action as
        | { status?: string }
        | undefined;
      return lastAction?.status === "expired";
    });
    expect(caducado).toBeDefined();
    const workingSet = (
      caducado?.metadata as { working_set?: Record<string, unknown> }
    )?.working_set;
    expect(workingSet?.structure_proposal).toBeNull();
  });

  it("sin borrador guardado, un comando suelto no crea nada", async () => {
    hoisted.memoryState = null;

    const plans: PlanTurnBlocksResult[] = [];
    const result = await buildOrchestrator(plans).handleTurn({
      externalEventId: "event-structure-1",
      turnInput: turnInput(`estr:${PROPOSAL_ID}`),
      traceId: "trace-structure",
    });

    expect(hoisted.executeStructureCommand).not.toHaveBeenCalled();
    expect(result.reason).toBe("accepted_with_structure_clarification");
    expect(plans[0]?.reason).toBe("structure_failed");
  });
});
