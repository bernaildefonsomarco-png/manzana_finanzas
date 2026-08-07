import { describe, expect, it, vi } from "vitest";
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
 */

const USER_ID = "00000000-0000-4000-8000-000000000001";
const MOVEMENT_ID = "00000000-0000-4000-8000-000000000010";

const externalEventFixture = {
  id: "event-correction-confirm-1",
  source: "dashboard" as const,
  event_type: "assistant_turn",
  idempotency_key: "idem-correction-confirm-1",
  user_id: USER_ID,
  received_at: "2026-08-06T10:00:00.000-05:00",
  status: "received" as const,
  payload_hash: "hash",
  payload_ref: null,
  trace_id: "trace-correction-confirm",
  metadata: {},
  created_at: "2026-08-06T10:00:00.000-05:00",
  updated_at: "2026-08-06T10:00:00.000-05:00",
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
    upsertConversationMemoryState: vi.fn(async () => null),
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
function memoryStateWithProposedDelete() {
  return {
    id: "state-1",
    user_id: USER_ID,
    channel: "dashboard" as const,
    scope: "default",
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
        status: "awaiting_confirmation" as const,
        source_ref: externalEventFixture.id,
        movement_ids: [MOVEMENT_ID],
        pending_item_ids: [],
        command_ids: [`corr:delete:${MOVEMENT_ID}`],
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

function buildOrchestrator() {
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
    dataAgent: {
      extract: vi.fn(async () => {
        throw new Error("data agent no deberia correr");
      }),
    } as unknown as DataAgent,
    conversationAgent: {
      answer: vi.fn(async () => {
        throw new Error("conversation agent no deberia correr");
      }),
    } as unknown as ConversationAgent,
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
