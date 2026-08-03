import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPendingItemsBySourceRefPrefix: vi.fn(),
}));

vi.mock("@/data/repositories/pending.repository", () => ({
  listPendingItemsBySourceRefPrefix: mocks.listPendingItemsBySourceRefPrefix,
}));

import { buildWebPresentTurn } from "./present-turn";
import type { ExternalEventLog } from "@/core/events/domain-events";
import type { PresentTurnContext } from "@/core/orchestrator/financial-orchestrator";
import type { ConversationTurnState } from "@/agents/conversation-agent";

const externalEvent: ExternalEventLog = {
  id: "event-1",
  source: "dashboard",
  event_type: "assistant.turn_received",
  idempotency_key: "key-1",
  user_id: "00000000-0000-4000-8000-000000000001",
  received_at: "2026-08-03T10:00:00.000Z",
  status: "accepted",
  payload_hash: "hash",
  payload_ref: null,
  trace_id: "trace-1",
  metadata: {},
  created_at: "2026-08-03T10:00:00.000Z",
  updated_at: "2026-08-03T10:00:00.000Z",
};

const turnState: ConversationTurnState = {
  act: "financial_capture",
  continuity: "new_topic",
  emotional_state: "neutral",
  experience_mode: "quick_capture",
  should_use_active_memory: false,
  should_route_to_conversation_agent: false,
  should_ask_clarification_first: false,
  response_guidance: [],
  personalization_cues: [],
  risk_notes: [],
};

const context: PresentTurnContext = {
  turnInput: {
    actor: "user",
    text: "gaste 20 en desayuno",
    choice: null,
    confirmation: null,
    attachments: [],
    context: { where: null, filters: null, selected: null, visible: [] },
    channel: "dashboard",
  },
  externalEventId: externalEvent.id,
  traceId: "trace-1",
  conversationTurnState: turnState,
};

function fakeClient(insertResult: { error: { code: string } | null } = { error: null }) {
  const insert = vi.fn(() => Promise.resolve({ data: null, ...insertResult }));
  return { from: vi.fn(() => ({ insert })), _insert: insert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.listPendingItemsBySourceRefPrefix.mockResolvedValue([]);
});

describe("buildWebPresentTurn", () => {
  it("persiste los bloques neutrales tal cual, sin traducirlos", async () => {
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
    });

    const result = await present(
      {
        blocks: [{ kind: "texto", text: "Registrado. Gasto de S/20 en Alimentación." }],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "asistente",
        thread_id: "thread-1",
        content: [{ kind: "texto", text: "Registrado. Gasto de S/20 en Alimentación." }],
      }),
    );
    expect(result.sendStatus).toBe("sent");
    expect(result.text).toBe("Registrado. Gasto de S/20 en Alimentación.");
  });

  it("recoge las referencias de evidencia de bloques cifra y hallazgo", async () => {
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
    });

    await present(
      {
        blocks: [
          {
            kind: "cifra",
            text: "S/318 en Alimentación",
            amount: 318,
            currency: "PEN",
            references: [{ kind: "movement", id: "m1" }, { kind: "movement", id: "m2" }],
          },
          {
            kind: "hallazgo",
            text: "sueles gastar mas los viernes",
            level: "impresion",
            references: [{ kind: "movement", id: "m3" }],
          },
        ],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        evidence_refs: ["movement:m1", "movement:m2", "movement:m3"],
      }),
    );
  });

  it("enlaza un bloque propuesta con el pendiente real creado en el mismo turno", async () => {
    mocks.listPendingItemsBySourceRefPrefix.mockResolvedValue([
      { id: "pending-1" },
      { id: "pending-2" },
    ]);
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
    });

    await present(
      {
        blocks: [
          { kind: "propuesta", text: "Voy a registrar un gasto", commandId: "", options: [] },
        ],
        intent: "pending_confirmation",
        reason: "pending_created",
      },
      context,
    );

    expect(mocks.listPendingItemsBySourceRefPrefix).toHaveBeenCalledWith(
      client,
      externalEvent.user_id,
      `dashboard:${externalEvent.id}:`,
    );
    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action_status: "propuesta",
        proposed_action: expect.objectContaining({
          pending_item_ids: ["pending-1", "pending-2"],
        }),
      }),
    );
  });

  it("no enlaza un pendiente cuando el bloque no es una propuesta", async () => {
    mocks.listPendingItemsBySourceRefPrefix.mockResolvedValue([{ id: "pending-1" }]);
    const client = fakeClient();
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
    });

    await present(
      {
        blocks: [{ kind: "texto", text: "Este mes llevas S/318 en Alimentación." }],
        intent: "direct_response",
        reason: "movement_created",
      },
      context,
    );

    expect(client._insert).toHaveBeenCalledWith(
      expect.objectContaining({ action_status: null, proposed_action: null }),
    );
  });

  it("un reintento exacto (idempotencia) no se trata como fallo de presentacion", async () => {
    const client = fakeClient({ error: { code: "23505" } });
    const present = await buildWebPresentTurn({
      client: client as never,
      externalEvent,
      threadId: "thread-1",
    });

    const result = await present(
      { blocks: [{ kind: "texto", text: "hola" }], intent: "direct_response", reason: "movement_created" },
      context,
    );

    expect(result.sendStatus).toBe("not_sent");
    expect(result.sendReason).toBe("duplicate");
  });
});
