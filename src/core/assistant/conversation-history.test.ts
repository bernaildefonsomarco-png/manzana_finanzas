import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { AssistantMessage } from "@/data/repositories/assistant.repository";

const mocks = vi.hoisted(() => ({
  listRecentAssistantMessages: vi.fn(),
  recallOlderThreadMessages: vi.fn(),
}));

vi.mock("@/data/repositories/assistant.repository", async (importActual) => ({
  ...(await importActual<
    typeof import("@/data/repositories/assistant.repository")
  >()),
  listRecentAssistantMessages: mocks.listRecentAssistantMessages,
}));

vi.mock("@/data/repositories/assistant-message-recall.repository", () => ({
  recallOlderThreadMessages: mocks.recallOlderThreadMessages,
}));

import { readThreadConversationHistory } from "./conversation-history";

const userId = "00000000-0000-4000-8000-000000000001";
const threadId = "00000000-0000-4000-8000-0000000000aa";
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function message(input: {
  role: AssistantMessage["role"];
  content: unknown[];
  traceId: string;
  id?: string;
  createdAt?: string;
}): AssistantMessage {
  return {
    id: input.id ?? `msg-${input.traceId}-${input.role}`,
    user_id: userId,
    thread_id: threadId,
    role: input.role,
    content: input.content,
    evidence_refs: [],
    proposed_action: null,
    action_status: null,
    resulting_movement_id: null,
    trace_id: input.traceId,
    created_at: input.createdAt ?? "2026-08-07T10:00:00.000-05:00",
  };
}

/** Un hilo largo: `count` mensajes ya cerrados, uno por minuto. */
function longThread(count: number): AssistantMessage[] {
  return Array.from({ length: count }, (_unused, index) =>
    message({
      role: index % 2 === 0 ? "usuario" : "asistente",
      content: [{ kind: "texto", text: `mensaje ${index}` }],
      traceId: `trace-${index}`,
      id: `msg-${index}`,
      createdAt: new Date(Date.UTC(2026, 7, 7, 10, index)).toISOString(),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recallOlderThreadMessages.mockResolvedValue([]);
});

describe("readThreadConversationHistory", () => {
  it("convierte los mensajes del hilo en turnos user/assistant", async () => {
    mocks.listRecentAssistantMessages.mockResolvedValue([
      message({
        role: "usuario",
        content: [{ kind: "texto", text: "gaste 20 en desayuno" }],
        traceId: "trace-1",
      }),
      message({
        role: "asistente",
        content: [
          { kind: "texto", text: "Anotado." },
          { kind: "cifra", text: "S/20.00 en desayuno", references: [] },
        ],
        traceId: "trace-1",
      }),
    ]);

    const history = await readThreadConversationHistory({
      client,
      userId,
      threadId,
      excludeTraceId: "trace-2",
    });

    expect(history).toEqual([
      { role: "user", text: "gaste 20 en desayuno" },
      { role: "assistant", text: "Anotado.\n\nS/20.00 en desayuno" },
    ]);
  });

  it("excluye el mensaje del turno en curso y los mensajes de sistema", async () => {
    mocks.listRecentAssistantMessages.mockResolvedValue([
      message({
        role: "usuario",
        content: [{ kind: "texto", text: "turno anterior" }],
        traceId: "trace-1",
      }),
      message({
        role: "sistema",
        content: [{ kind: "texto", text: "nota interna" }],
        traceId: "trace-1",
      }),
      message({
        role: "usuario",
        content: [{ kind: "texto", text: "turno actual" }],
        traceId: "trace-actual",
      }),
    ]);

    const history = await readThreadConversationHistory({
      client,
      userId,
      threadId,
      excludeTraceId: "trace-actual",
    });

    expect(history).toEqual([{ role: "user", text: "turno anterior" }]);
  });

  it("degrada a historial vacio si el hilo no se puede leer", async () => {
    mocks.listRecentAssistantMessages.mockRejectedValue(new Error("db caida"));

    await expect(
      readThreadConversationHistory({
        client,
        userId,
        threadId,
        excludeTraceId: "trace-actual",
      })
    ).resolves.toEqual([]);
  });

  it("no consulta nada cuando el canal no tiene hilo", async () => {
    const history = await readThreadConversationHistory({
      client,
      userId,
      threadId: null,
      excludeTraceId: "trace-actual",
    });

    expect(history).toEqual([]);
    expect(mocks.listRecentAssistantMessages).not.toHaveBeenCalled();
  });
});

describe("readThreadConversationHistory: memoria semantica del hilo (`077`)", () => {
  it("no gasta una busqueda cuando el hilo entero cabe en la ventana", async () => {
    mocks.listRecentAssistantMessages.mockResolvedValue(longThread(4));

    const history = await readThreadConversationHistory({
      client,
      userId,
      threadId,
      excludeTraceId: "trace-actual",
      queryText: "y la caja Viaje?",
    });

    expect(history).toHaveLength(4);
    expect(mocks.recallOlderThreadMessages).not.toHaveBeenCalled();
  });

  it("recupera lo anterior a la ventana y corta justo donde empieza lo textual", async () => {
    mocks.listRecentAssistantMessages.mockResolvedValue(longThread(26));
    mocks.recallOlderThreadMessages.mockResolvedValue([
      {
        id: "msg-viejo",
        role: "usuario",
        text: "la caja Viaje es para diciembre",
        created_at: "2026-07-01T10:00:00.000Z",
        similarity: 0.71,
      },
    ]);

    const history = await readThreadConversationHistory({
      client,
      userId,
      threadId,
      excludeTraceId: "trace-actual",
      queryText: "cuanto tengo en la caja Viaje?",
    });

    // El corte es la fecha del mensaje mas viejo que ya viaja textual: de los
    // 26 leidos solo entran los ultimos 20, asi que el corte es el numero 6.
    expect(mocks.recallOlderThreadMessages).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        threadId,
        queryText: "cuanto tengo en la caja Viaje?",
        before: new Date(Date.UTC(2026, 7, 7, 10, 6)).toISOString(),
      })
    );

    // Lo recuperado va primero y marcado; lo textual queda intacto detras.
    expect(history[0]).toEqual({
      role: "user",
      text: "la caja Viaje es para diciembre",
      recalled: true,
      said_at: "2026-07-01T10:00:00.000Z",
    });
    expect(history).toHaveLength(21);
    expect(history[1]).toEqual({ role: "user", text: "mensaje 6" });
    expect(history.at(-1)).toEqual({ role: "assistant", text: "mensaje 25" });
  });

  it("busca tambien cuando la ventana llena no prueba que no haya mas atras", async () => {
    // 30 leidos es el tope de lectura: puede haber mas hilo detras aunque los
    // turnos entregados no hayan descartado ninguno.
    mocks.listRecentAssistantMessages.mockResolvedValue([
      ...longThread(29),
      message({
        role: "usuario",
        content: [{ kind: "texto", text: "turno actual" }],
        traceId: "trace-actual",
        id: "msg-actual",
        createdAt: new Date(Date.UTC(2026, 7, 7, 10, 29)).toISOString(),
      }),
    ]);

    await readThreadConversationHistory({
      client,
      userId,
      threadId,
      excludeTraceId: "trace-actual",
      queryText: "cuanto tengo en la caja Viaje?",
    });

    expect(mocks.recallOlderThreadMessages).toHaveBeenCalledTimes(1);
  });

  it("no busca sin el mensaje del turno: no hay contra que parecerse", async () => {
    mocks.listRecentAssistantMessages.mockResolvedValue(longThread(26));

    const history = await readThreadConversationHistory({
      client,
      userId,
      threadId,
      excludeTraceId: "trace-actual",
    });

    expect(history).toHaveLength(20);
    expect(mocks.recallOlderThreadMessages).not.toHaveBeenCalled();
  });

  it("degrada a la ventana textual cuando la recuperacion no devuelve nada", async () => {
    mocks.listRecentAssistantMessages.mockResolvedValue(longThread(26));
    mocks.recallOlderThreadMessages.mockResolvedValue([]);

    const history = await readThreadConversationHistory({
      client,
      userId,
      threadId,
      excludeTraceId: "trace-actual",
      queryText: "cuanto tengo en la caja Viaje?",
    });

    expect(history).toHaveLength(20);
    expect(history.every((turn) => !turn.recalled)).toBe(true);
  });
});
