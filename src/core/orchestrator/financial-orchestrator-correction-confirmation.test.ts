import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationalExecutiveAgent } from "@/agents/conversational-executive-agent";
import type { ConversationAgent } from "@/agents/conversation-agent";
import type { DataAgent } from "@/agents/data-agent";
import type { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import type { PresentedTurn } from "@/core/channel/types";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import type { Movement } from "@/shared/types/domain";
import { FinancialOrchestrator } from "./financial-orchestrator";

/**
 * Reproduccion en vivo (`16` §10.3): el usuario pide "elimine al gasto de pan
 * porfa", Manzana propone "Creo que te refieres a Pan S/5.00. ¿Lo elimino?" y
 * en el turno siguiente el usuario confirma escribiendo. Antes del arreglo ese
 * "si" caia en el resolutor de pendientes -> borrador de captura y respondia
 * "No encontre algo reciente para registrar con seguridad", sin eliminar nada.
 *
 * La segunda mitad del fichero cubre el defecto que ese puente dejo abierto
 * (`23` §5b.1, `AC-RT-13`): la propuesta quedaba armada indefinidamente y en
 * cualquier hilo, asi que un "hola" la re-emitia y un "si" posterior sobre otro
 * tema podia ejecutar la eliminacion.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const MOVEMENT_ID = "00000000-0000-4000-8000-000000000010";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const OTHER_THREAD_ID = "00000000-0000-4000-8000-0000000000bb";
const THREAD_KEY = `hilo:${THREAD_ID}`;
const RECEIVED_AT = "2026-08-06T10:00:00.000-05:00";

const externalEventFixture = {
  id: "event-correction-confirm-1",
  source: "dashboard" as const,
  event_type: "assistant_turn",
  idempotency_key: "idem-correction-confirm-1",
  user_id: USER_ID,
  received_at: RECEIVED_AT,
  status: "received" as const,
  payload_hash: "hash",
  payload_ref: null,
  trace_id: "trace-correction-confirm",
  metadata: { thread_id: THREAD_ID } as Record<string, unknown>,
  created_at: RECEIVED_AT,
  updated_at: RECEIVED_AT,
};

const movementFixture: Movement = {
  id: MOVEMENT_ID,
  user_id: USER_ID,
  type: "gasto",
  status: "confirmed",
  amount: 5,
  currency: "PEN",
  occurred_at: "2026-08-05T12:00:00.000-05:00",
  description: "pan",
  merchant: null,
  category_id: "alimentacion",
  subcategory_id: null,
  source: "dashboard_manual",
  source_ref: null,
  idempotency_key: "mov-pan",
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
  affects_total_balance: true,
  affects_account_balance: false,
  created_at: "2026-08-05T12:00:00.000-05:00",
  updated_at: "2026-08-05T12:00:00.000-05:00",
  deleted_at: null,
  metadata: {},
};

const hoisted = vi.hoisted(() => ({
  dispatch: vi.fn(),
  memoryState: null as unknown,
  eventMetadata: { thread_id: "00000000-0000-4000-8000-0000000000aa" } as Record<
    string,
    unknown
  >,
  receivedAt: "2026-08-06T10:00:00.000-05:00",
  upserts: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => ({
    ...externalEventFixture,
    metadata: hoisted.eventMetadata,
    received_at: hoisted.receivedAt,
  })),
  updateExternalEventStatus: vi.fn(async () => undefined),
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

vi.mock("@/data/repositories/movements.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/movements.repository")
  >();
  return {
    ...actual,
    SupabaseFinancialCoreRepository: class {
      async getMovementById(): Promise<Movement> {
        return movementFixture;
      }
    },
  };
});

vi.mock("@/core/finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/finance")>();
  return {
    ...actual,
    CommandDispatcher: class {
      dispatch = hoisted.dispatch;
    },
  };
});

/** Memoria conversacional tal como la deja el turno de la propuesta. */
function memoryStateWithProposedDelete(
  overrides: {
    threadKey?: string | null;
    confirmationExpiresAt?: string | null;
    status?: "awaiting_confirmation" | "expired";
  } = {},
) {
  return {
    id: "state-1",
    user_id: USER_ID,
    channel: "dashboard" as const,
    scope: "default",
    thread_key:
      overrides.threadKey === undefined ? THREAD_KEY : overrides.threadKey ?? "",
    last_intent: "correction",
    last_query_kind: null,
    last_query_text: "elimine al gasto de pan porfa",
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary: "Creo que te refieres a Pan S/5.00. ¿Lo elimino?",
    referenced_movements: [],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: externalEventFixture.id,
    expires_at: "2026-08-06T12:00:00.000-05:00",
    created_at: externalEventFixture.received_at,
    updated_at: externalEventFixture.received_at,
    metadata: {},
    working_set: {
      version: "v1" as const,
      topic: "movement" as const,
      goal: "correct" as const,
      last_user_message_summary: "elimine al gasto de pan porfa",
      last_assistant_result_summary:
        "Creo que te refieres a Pan S/5.00. ¿Lo elimino?",
      last_action: {
        kind: "correction_proposed" as const,
        status: overrides.status ?? ("awaiting_confirmation" as const),
        source_ref: externalEventFixture.id,
        movement_ids: [MOVEMENT_ID],
        pending_item_ids: [],
        command_ids: [`corr:delete:${MOVEMENT_ID}`],
        thread_key:
          overrides.threadKey === undefined ? THREAD_KEY : overrides.threadKey,
        confirmation_expires_at:
          overrides.confirmationExpiresAt === undefined
            ? "2026-08-06T10:15:00.000-05:00"
            : overrides.confirmationExpiresAt,
      },
      unresolved_slots: [],
      movement_referents: [MOVEMENT_ID],
      entity_referents: [],
      active_read_operation: null,
      focus_set: null,
      conversation_style: null,
      updated_at: externalEventFixture.received_at,
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

/**
 * Turno normal que no habla de ninguna correccion: el planificador falla (se
 * traga el error y sigue sin plan) y el agente de datos no propone nada, asi
 * que el turno termina como respuesta conversacional.
 */
function buildContinuingAgents(options: { answerKind?: "clarification" | "unsupported" } = {}) {
  return {
    dataAgent: {
      extract: vi.fn(async () => ({
        output: {
          intent: "conversation" as const,
          result: [],
          confidence: 0.9,
          requires_confirmation: false,
          ambiguities: [],
        },
        runtime: {
          provider: "local_deterministic" as const,
          model_name: "test",
          latency_ms: 1,
        },
        safety: { policy_flags: [], redaction_applied: false },
      })),
    } as unknown as DataAgent,
    conversationAgent: {
      answer: vi.fn(async () => ({
        output: {
          response_text: "¡Hola! ¿Qué hacemos hoy?",
          answer_kind: (options.answerKind ?? "clarification") as
            | "clarification"
            | "unsupported",
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
  };
}

function buildOrchestrator(
  options: {
    continueTurn?: boolean;
    answerKind?: "clarification" | "unsupported";
  } = {},
) {
  const continuing = options.continueTurn
    ? buildContinuingAgents({ answerKind: options.answerKind })
    : null;
  const executiveRun = vi.fn(async () => {
    throw new Error("el ejecutivo no deberia decidir una correccion ya propuesta");
  });
  const presentTurn = vi.fn(async (_plan: PlanTurnBlocksResult) =>
    fakePresentedTurn(),
  );
  const orchestrator = new FinancialOrchestrator(createGenericSupabaseClient(), {
    conversationalExecutiveMode: "active",
    conversationalExecutiveAgent: {
      run: executiveRun,
    } as unknown as ConversationalExecutiveAgent,
    orchestrationPlanningAgent: {
      plan: vi.fn(async () => {
        throw new Error("planner legado no deberia correr");
      }),
    } as unknown as OrchestrationPlanningAgent,
    dataAgent:
      continuing?.dataAgent ??
      ({
        extract: vi.fn(async () => {
          throw new Error("data agent no deberia correr");
        }),
      } as unknown as DataAgent),
    conversationAgent:
      continuing?.conversationAgent ??
      ({
        answer: vi.fn(async () => {
          throw new Error("conversation agent no deberia correr");
        }),
      } as unknown as ConversationAgent),
    presentTurn,
  });

  return { orchestrator, presentTurn, executiveRun };
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

beforeEach(() => {
  hoisted.memoryState = null;
  hoisted.eventMetadata = { thread_id: THREAD_ID };
  hoisted.receivedAt = RECEIVED_AT;
  hoisted.upserts = [];
  hoisted.dispatch.mockReset();
});

/** Todos los `last_action` que el turno dejo escritos, en orden. */
function writtenActions(): Array<Record<string, unknown>> {
  return hoisted.upserts
    .map((upsert) => {
      const metadata = upsert?.metadata as
        | { working_set?: { last_action?: Record<string, unknown> | null } }
        | undefined;
      return metadata?.working_set?.last_action ?? null;
    })
    .filter((action): action is Record<string, unknown> => action !== null);
}

/**
 * Estado conversacional tal como queda en base despues del turno anterior: el
 * ultimo upsert que escribio un `working_set`, o el estado previo intacto si el
 * turno no escribio ninguno (que es justo cuando la propuesta se quedaba
 * pegada).
 */
function memoryStateAfterTurn(previous: ReturnType<typeof memoryStateWithProposedDelete>) {
  for (let index = hoisted.upserts.length - 1; index >= 0; index -= 1) {
    const metadata = hoisted.upserts[index]?.metadata as
      | { working_set?: Record<string, unknown> }
      | undefined;
    if (metadata?.working_set) {
      return {
        ...previous,
        metadata,
        working_set: metadata.working_set,
      } as typeof previous;
    }
  }
  return previous;
}

function writtenCorrectionActions(): Array<Record<string, unknown>> {
  return writtenActions().filter(
    (action) => action.kind === "correction_proposed",
  );
}

describe("confirmacion escrita de una eliminacion propuesta", () => {
  it("elimina el movimiento cuando el usuario confirma con texto libre", async () => {
    hoisted.memoryState = memoryStateWithProposedDelete();
    hoisted.dispatch.mockReset();
    hoisted.dispatch.mockResolvedValue({
      movement: { ...movementFixture, status: "deleted" },
    });
    const { orchestrator, presentTurn, executiveRun } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-correction-confirm",
      turnInput: turnInput("si te confirmo eliminalo"),
    });

    expect(hoisted.dispatch).toHaveBeenCalledTimes(1);
    expect(hoisted.dispatch.mock.calls[0][0]).toMatchObject({
      type: "DeleteMovementCommand",
      payload: { movement_id: MOVEMENT_ID, mode: "soft_delete" },
    });
    expect(result.reason).toBe("accepted_with_correction_applied");
    expect(executiveRun).not.toHaveBeenCalled();

    const plan = presentTurn.mock.calls[0][0];
    expect(plan.reason).toBe("correction_applied");
    const text = plan.blocks
      .map((block) => ("text" in block ? block.text : ""))
      .join(" ");
    expect(text).toContain("Eliminé");
    expect(text).not.toContain("No encontre algo reciente");
  });

  it("no elimina nada si no hay una correccion esperando confirmacion", async () => {
    hoisted.memoryState = null;
    hoisted.dispatch.mockReset();
    const { orchestrator } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-correction-confirm",
      turnInput: turnInput("si te confirmo eliminalo"),
    });

    expect(hoisted.dispatch).not.toHaveBeenCalled();
    expect(result.reason).not.toBe("accepted_with_correction_applied");
  });
});

/**
 * Secuencia real capturada en produccion, en el mismo hilo:
 *
 *   usuario  -> "elimine al gasto de pan porfa"
 *   asistente-> "Creo que te refieres a Pan S/5.00. ¿Lo elimino?"
 *   usuario  -> "hola"
 *   asistente-> "Creo que te refieres a Pan S/5.00. ¿Lo elimino?"   <- defecto
 *
 * `23` §5b.1: la propuesta caduca "a los 15 minutos, o al cambiar de tema", y
 * al caducar no puede quedar armada para que un "si" posterior la dispare
 * (`AC-RT-13`).
 */
describe("una propuesta pendiente caduca al cambiar de tema (`23` §5b.1)", () => {
  it("un saludo no ejecuta la eliminacion y deja la propuesta caducada", async () => {
    hoisted.memoryState = memoryStateWithProposedDelete();
    const { orchestrator } = buildOrchestrator({ continueTurn: true });

    await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-hola",
      turnInput: turnInput("hola"),
    });

    expect(hoisted.dispatch).not.toHaveBeenCalled();

    // La propuesta quedo caducada y sin comandos: nada que un "si" posterior
    // pueda disparar.
    expect(writtenCorrectionActions()).toEqual([
      expect.objectContaining({ status: "expired", command_ids: [] }),
    ]);
  });

  it("y el 'si' del turno siguiente ya no elimina nada", async () => {
    const estadoInicial = memoryStateWithProposedDelete();
    hoisted.memoryState = estadoInicial;
    // `answer_kind: "unsupported"` no escribe memoria conversacional
    // (`rememberConversationTurn` sale antes): reproduce el caso real en que
    // el turno intermedio no reescribe `last_action` y la propuesta se quedaba
    // pegada esperando un "si".
    const saludo = buildOrchestrator({
      continueTurn: true,
      answerKind: "unsupported",
    });

    await saludo.orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-hola",
      turnInput: turnInput("hola"),
    });

    // El segundo turno arranca del estado que dejo el primero, no de uno
    // inventado: es la secuencia completa del reporte de produccion.
    hoisted.memoryState = memoryStateAfterTurn(estadoInicial);
    hoisted.upserts = [];
    hoisted.dispatch.mockReset();
    const confirmacion = buildOrchestrator({ continueTurn: true });

    const result = await confirmacion.orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-si-tardio",
      turnInput: turnInput("si"),
    });

    expect(hoisted.dispatch).not.toHaveBeenCalled();
    expect(result.reason).not.toBe("accepted_with_correction_applied");
  });
});

describe("la propuesta pendiente pertenece a un hilo y a un momento", () => {
  it("un 'si' en otra conversacion no ejecuta la eliminacion de la primera", async () => {
    hoisted.memoryState = memoryStateWithProposedDelete();
    hoisted.eventMetadata = { thread_id: OTHER_THREAD_ID };
    const { orchestrator } = buildOrchestrator({ continueTurn: true });

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-otro-hilo",
      turnInput: turnInput("si te confirmo eliminalo"),
    });

    expect(hoisted.dispatch).not.toHaveBeenCalled();
    expect(result.reason).not.toBe("accepted_with_correction_applied");
    // Y no le toca la propuesta al hilo que si la esta esperando.
    expect(writtenCorrectionActions()).toEqual([]);
  });

  it("pasados los 15 minutos se responde la caducidad en vez de eliminar", async () => {
    hoisted.memoryState = memoryStateWithProposedDelete();
    hoisted.receivedAt = "2026-08-06T10:20:00.000-05:00";
    const { orchestrator, presentTurn } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-vencida",
      turnInput: turnInput("si te confirmo eliminalo"),
    });

    expect(hoisted.dispatch).not.toHaveBeenCalled();
    expect(result.reason).toBe("accepted_with_correction_lapsed");

    const text = presentTurn.mock.calls[0][0].blocks
      .map((block) => ("text" in block ? block.text : ""))
      .join(" ");
    expect(text).toContain("quedó pendiente y ya venció");
  });

  it("un estado sin sello de hilo (escrito antes del arreglo) no se confirma", async () => {
    hoisted.memoryState = memoryStateWithProposedDelete({ threadKey: null });
    const { orchestrator, presentTurn } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-sin-hilo",
      turnInput: turnInput("si te confirmo eliminalo"),
    });

    expect(hoisted.dispatch).not.toHaveBeenCalled();
    expect(result.reason).toBe("accepted_with_correction_lapsed");
    expect(presentTurn.mock.calls[0][0].reason).toBe(
      "correction_needs_clarification",
    );
  });
});
