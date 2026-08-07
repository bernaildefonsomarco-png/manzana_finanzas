import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { AssistantMessage } from "@/data/repositories/assistant.repository";

const mocks = vi.hoisted(() => ({
  listRecentAssistantMessages: vi.fn(),
}));

vi.mock("@/data/repositories/assistant.repository", () => ({
  listRecentAssistantMessages: mocks.listRecentAssistantMessages,
}));

import { readThreadConversationHistory } from "./conversation-history";

const userId = "00000000-0000-4000-8000-000000000001";
const threadId = "00000000-0000-4000-8000-0000000000aa";
const client = { from: vi.fn() } as unknown as SupabaseClient<Database>;

function message(input: {
  role: AssistantMessage["role"];
  content: unknown[];
  traceId: string;
}): AssistantMessage {
  return {
    id: `msg-${input.traceId}-${input.role}`,
    user_id: userId,
    thread_id: threadId,
    role: input.role,
    content: input.content,
    evidence_refs: [],
    proposed_action: null,
    action_status: null,
    resulting_movement_id: null,
    trace_id: input.traceId,
    created_at: "2026-08-07T10:00:00.000-05:00",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
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
