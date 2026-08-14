import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationalExecutiveAgent } from "@/agents/conversational-executive-agent";
import type { ConversationAgent } from "@/agents/conversation-agent";
import type { DataAgent } from "@/agents/data-agent";
import type { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import type { PresentedTurn } from "@/core/channel/types";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import type { Movement, UserSubcategory } from "@/shared/types/domain";
import { FinancialOrchestrator } from "./financial-orchestrator";

/**
 * El caso real, de punta a punta y por el camino del asistente: la persona ya
 * creo "Animales" dentro de "Vivienda / Hogar" (`RUL-ESTR-01`, desde que la
 * estructura se escribe hablando) y quiere meter ahi la comida de sus gatos,
 * que ya estaba registrada. Hasta ahora no habia forma: se podia cambiar la
 * categoria de un movimiento hablando, pero no su subcategoria.
 *
 * Son dos turnos a proposito. El motor atiende **una sola superficie por
 * turno**, y eso no se toca aqui: crear la subcategoria y mover el movimiento
 * en el mismo mensaje sigue sin funcionar, y el turno lo anuncia en vez de
 * callarlo. Dos mensajes seguidos —"crea Animales", "ahora mete ese gasto
 * ahi"— es lo que tiene que funcionar.
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const MOVEMENT_ID = "00000000-0000-4000-8000-000000000010";
const SUBCATEGORY_ID = "00000000-0000-4000-8000-0000000000d1";
const THREAD_ID = "00000000-0000-4000-8000-0000000000aa";
const THREAD_KEY = `hilo:${THREAD_ID}`;
const RECEIVED_AT = "2026-08-13T10:00:00.000-05:00";
const COMMAND_ID = `corr:subcategory:${MOVEMENT_ID}:${SUBCATEGORY_ID}`;

const externalEventFixture = {
  id: "event-subcategory-1",
  source: "dashboard" as const,
  event_type: "assistant_turn",
  idempotency_key: "idem-subcategory-1",
  user_id: USER_ID,
  received_at: RECEIVED_AT,
  status: "received" as const,
  payload_hash: "hash",
  payload_ref: null,
  trace_id: "trace-subcategory",
  metadata: { thread_id: THREAD_ID } as Record<string, unknown>,
  created_at: RECEIVED_AT,
  updated_at: RECEIVED_AT,
};

const movementFixture: Movement = {
  id: MOVEMENT_ID,
  user_id: USER_ID,
  type: "gasto",
  status: "confirmed",
  amount: 45,
  currency: "PEN",
  occurred_at: "2026-08-13T09:00:00.000-05:00",
  description: "comida de los gatos",
  merchant: null,
  category_id: "vivienda_hogar",
  subcategory_id: null,
  source: "dashboard_manual",
  source_ref: null,
  idempotency_key: "mov-gatos",
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
  created_at: "2026-08-13T09:00:00.000-05:00",
  updated_at: "2026-08-13T09:00:00.000-05:00",
  deleted_at: null,
  metadata: {},
};

const subcategoryFixture: UserSubcategory = {
  id: SUBCATEGORY_ID,
  user_id: USER_ID,
  category_id: "vivienda_hogar",
  label: "Animales",
  normalized_label: "animales",
  created_by: "user",
  created_at: "2026-08-13T08:00:00.000-05:00",
  updated_at: "2026-08-13T08:00:00.000-05:00",
  deleted_at: null,
  metadata: {},
};

const hoisted = vi.hoisted(() => ({
  dispatch: vi.fn(),
  memoryState: null as unknown,
  subcategories: [] as Array<Record<string, unknown>>,
  upserts: [] as Array<Record<string, unknown>>,
  plans: [] as unknown[],
}));

vi.mock("@/data/repositories/events.repository", () => ({
  getExternalEventById: vi.fn(async () => externalEventFixture),
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
    listRecentMovementsForCorrection: vi.fn(async () => [
      {
        id: movementFixture.id,
        type: movementFixture.type,
        amount: movementFixture.amount,
        currency: movementFixture.currency,
        description: movementFixture.description,
        merchant: movementFixture.merchant,
        category_id: movementFixture.category_id,
        occurred_at: movementFixture.occurred_at,
        created_at: movementFixture.created_at,
        status: movementFixture.status,
        account_origin_id: movementFixture.account_origin_id,
        account_destination_id: movementFixture.account_destination_id,
        metadata: movementFixture.metadata,
      },
    ]),
    listRecentMovementsForPreflight: vi.fn(async () => []),
    SupabaseFinancialCoreRepository: class {
      async getMovementById(): Promise<Movement> {
        return movementFixture;
      }
    },
  };
});

vi.mock("@/data/repositories/classification.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/classification.repository")
  >();
  return {
    ...actual,
    getClassificationCatalog: vi.fn(async () => ({
      version: "v1" as const,
      categories: [],
      subcategories: hoisted.subcategories,
      tags: [],
      related_people: [],
    })),
    getSubcategoryById: vi.fn(async (_client, userId: string, id: string) =>
      // `SEG-04`: el repositorio filtra por usuario. Aqui se replica ese filtro
      // para que el test falle si el orquestador deja de pasarle el usuario del
      // turno y empieza a confiar en el id que venia en el comando.
      userId === USER_ID && id === SUBCATEGORY_ID ? subcategoryFixture : null,
    ),
  };
});

vi.mock("@/data/repositories/categories.repository", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/data/repositories/categories.repository")
  >();
  return {
    ...actual,
    getAllCategories: vi.fn(async () => [
      {
        id: "vivienda_hogar",
        label: "Vivienda / Hogar",
        is_sensitive: false,
      },
      { id: "salud", label: "Salud", is_sensitive: true },
    ]),
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
 * Orquestador con los dos agentes semanticos apagados: el ejecutivo y el
 * planificador fallan, asi que el turno cae al camino determinista, que es el
 * que este test quiere ejercitar de verdad.
 */
function buildOrchestrator() {
  const presentTurn = vi.fn(async (plan: PlanTurnBlocksResult) => {
    hoisted.plans.push(plan);
    return fakePresentedTurn();
  });
  const orchestrator = new FinancialOrchestrator(createGenericSupabaseClient(), {
    conversationalExecutiveMode: "active",
    conversationalExecutiveAgent: {
      run: vi.fn(async () => {
        throw new Error("el ejecutivo no decide en este test");
      }),
    } as unknown as ConversationalExecutiveAgent,
    orchestrationPlanningAgent: {
      plan: vi.fn(async () => {
        throw new Error("el planificador no decide en este test");
      }),
    } as unknown as OrchestrationPlanningAgent,
    dataAgent: {
      extract: vi.fn(async () => ({
        output: {
          intent: "correction" as const,
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
      answer: vi.fn(async () => {
        throw new Error("el agente de conversacion no deberia correr");
      }),
    } as unknown as ConversationAgent,
    presentTurn,
  });

  return { orchestrator, presentTurn };
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

function subcategoryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBCATEGORY_ID,
    category_id: "vivienda_hogar",
    label: "Animales",
    normalized_label: "animales",
    ...overrides,
  };
}

/** Memoria conversacional tal como la deja el turno de la propuesta. */
function memoryStateWithProposal() {
  return {
    id: "state-1",
    user_id: USER_ID,
    channel: "dashboard" as const,
    scope: "default",
    thread_key: THREAD_KEY,
    last_intent: "correction",
    last_query_kind: null,
    last_query_text: "ponlo en Animales",
    last_query_date_range: null,
    last_tool_name: null,
    last_result_summary:
      "Creo que te refieres a Comida de los gatos S/45.00. ¿Lo cambio?",
    referenced_movements: [],
    referenced_entities: [],
    continuity_hint: null,
    source_ref: externalEventFixture.id,
    expires_at: "2026-08-13T12:00:00.000-05:00",
    created_at: RECEIVED_AT,
    updated_at: RECEIVED_AT,
    metadata: {},
    working_set: {
      version: "v1" as const,
      topic: "movement" as const,
      goal: "correct" as const,
      last_user_message_summary: "ponlo en Animales",
      last_assistant_result_summary:
        "Creo que te refieres a Comida de los gatos S/45.00. ¿Lo cambio?",
      last_action: {
        kind: "correction_proposed" as const,
        status: "awaiting_confirmation" as const,
        source_ref: externalEventFixture.id,
        movement_ids: [MOVEMENT_ID],
        pending_item_ids: [],
        command_ids: [COMMAND_ID],
        thread_key: THREAD_KEY,
        confirmation_expires_at: "2026-08-13T10:15:00.000-05:00",
      },
      unresolved_slots: [],
      movement_referents: [MOVEMENT_ID],
      entity_referents: [],
      active_read_operation: null,
      focus_set: null,
      conversation_style: null,
      updated_at: RECEIVED_AT,
    },
  };
}

beforeEach(() => {
  hoisted.memoryState = null;
  hoisted.subcategories = [subcategoryRow()];
  hoisted.upserts = [];
  hoisted.plans = [];
  hoisted.dispatch.mockReset();
});

/** El ultimo bloque que el turno le paso al presentador. */
function lastPlan(): PlanTurnBlocksResult {
  return hoisted.plans[hoisted.plans.length - 1] as PlanTurnBlocksResult;
}

describe("meter un gasto ya registrado en una subcategoria, hablando", () => {
  it("propone el cambio con el nombre de la subcategoria y su categoria", async () => {
    const { orchestrator } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-subcategory-propose",
      turnInput: turnInput("ponlo en Animales"),
    });

    expect(result.reason).toBe("accepted_with_correction_confirmation");
    // Nada se escribe antes del "si": la propuesta es una pregunta.
    expect(hoisted.dispatch).not.toHaveBeenCalled();

    const plan = lastPlan();
    expect(plan.reason).toBe("correction_needs_confirmation");
    expect(plan.blocks[0]).toMatchObject({
      kind: "propuesta",
      commandId: COMMAND_ID,
      text: "Creo que te refieres a Comida de los gatos S/45. ¿Lo cambio a Animales, dentro de Vivienda / Hogar?",
      options: [
        { id: COMMAND_ID, label: "Sí, cambiar" },
        { id: "corr:cancel", label: "No cambiar" },
      ],
    });
  });

  it("al confirmar, el movimiento queda en la subcategoria y en su categoria madre", async () => {
    hoisted.memoryState = memoryStateWithProposal();
    hoisted.dispatch.mockResolvedValue({
      movement: { ...movementFixture, subcategory_id: SUBCATEGORY_ID },
    });
    const { orchestrator } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-subcategory-confirm",
      turnInput: turnInput("si, cambialo"),
    });

    expect(result.reason).toBe("accepted_with_correction_applied");
    expect(hoisted.dispatch).toHaveBeenCalledTimes(1);
    expect(hoisted.dispatch.mock.calls[0]?.[0]).toMatchObject({
      type: "CorrectMovementCommand",
      user_id: USER_ID,
      payload: {
        movement_id: MOVEMENT_ID,
        corrected_fields: {
          category_id: "vivienda_hogar",
          subcategory_id: SUBCATEGORY_ID,
        },
      },
    });
    expect(lastPlan().reason).toBe("correction_applied");
    expect(lastPlan().blocks[0]).toMatchObject({
      text: "Listo. Cambié Comida de los gatos S/45.00 a Animales, dentro de Vivienda / Hogar. Tus saldos ya se recalcularon.",
    });
  });

  it("si el nombre no existe, lo dice con esa palabra y no toca nada", async () => {
    hoisted.subcategories = [
      subcategoryRow({
        id: "00000000-0000-4000-8000-0000000000d9",
        label: "Mascotas",
        normalized_label: "mascotas",
      }),
    ];
    const { orchestrator } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-subcategory-missing",
      turnInput: turnInput("ponlo en Animales"),
    });

    expect(result.reason).toBe("accepted_with_correction_clarification");
    expect(hoisted.dispatch).not.toHaveBeenCalled();
    expect(lastPlan().reason).toBe("correction_needs_clarification");
    expect(lastPlan().blocks[0]).toMatchObject({
      text: 'No tienes una subcategoría "Animales", así que no moví nada. Si quieres, dime en qué categoría la creo y después te muevo el movimiento ahí.',
    });
  });

  it("si el nombre existe en dos categorias, pregunta cual en vez de elegir", async () => {
    hoisted.subcategories = [
      subcategoryRow(),
      subcategoryRow({
        id: "00000000-0000-4000-8000-0000000000d2",
        category_id: "salud",
      }),
    ];
    const { orchestrator } = buildOrchestrator();

    const result = await orchestrator.handleTurn({
      externalEventId: externalEventFixture.id,
      traceId: "trace-subcategory-ambiguous",
      turnInput: turnInput("ponlo en Animales"),
    });

    expect(result.reason).toBe("accepted_with_correction_clarification");
    expect(hoisted.dispatch).not.toHaveBeenCalled();
    expect(lastPlan().reason).toBe("correction_needs_clarification");
    const block = lastPlan().blocks[0];
    if (!block || !("text" in block)) {
      throw new Error("se esperaba un bloque con texto");
    }
    expect(block.text).toContain("Vivienda / Hogar y Salud");
    expect(block.text).toContain("no moví nada");
  });
});
