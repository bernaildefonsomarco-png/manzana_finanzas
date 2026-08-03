// `41` S14: un turno exige `Idempotency-Key`; sin `thread_id` crea un hilo
// nuevo; con uno inexistente (o de otro usuario, por RLS) devuelve 404.
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  handleWebAssistantTurn: vi.fn(),
  createAssistantThread: vi.fn(),
  getAssistantThreadById: vi.fn(),
  listAssistantMessages: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/core/assistant/handle-web-turn", () => ({
  handleWebAssistantTurn: mocks.handleWebAssistantTurn,
}));
vi.mock("@/data/repositories/assistant.repository", async (original) => ({
  ...(await original()),
  createAssistantThread: mocks.createAssistantThread,
  getAssistantThreadById: mocks.getAssistantThreadById,
  listAssistantMessages: mocks.listAssistantMessages,
}));

import { POST } from "./route";

const userId = "11111111-1111-4111-8111-111111111111";
const threadId = "22222222-2222-4222-8222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId, client: {} });
  mocks.createAssistantThread.mockResolvedValue({ id: threadId });
  mocks.getAssistantThreadById.mockResolvedValue({ id: threadId, user_id: userId });
  mocks.listAssistantMessages.mockResolvedValue([]);
  mocks.handleWebAssistantTurn.mockResolvedValue({
    status: "accepted",
    externalEventId: "event-1",
    duplicate: false,
  });
});

function turnRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = { "idempotency-key": "key-12345678" }
) {
  return new Request("http://localhost/api/v1/assistant/turns", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/assistant/turns", () => {
  it("exige Idempotency-Key", async () => {
    const response = await POST(turnRequest({ text: "hola" }, {}));
    expect(response.status).toBe(400);
    expect(mocks.handleWebAssistantTurn).not.toHaveBeenCalled();
  });

  it("sin thread_id crea un hilo nuevo antes de llamar al motor", async () => {
    const response = await POST(turnRequest({ text: "gaste 20 en desayuno" }));

    expect(response.status).toBe(201);
    expect(mocks.createAssistantThread).toHaveBeenCalledWith({}, userId);
    expect(mocks.handleWebAssistantTurn).toHaveBeenCalledWith(
      expect.objectContaining({ threadId, text: "gaste 20 en desayuno" }),
    );
  });

  it("con un thread_id que no existe (o es de otro usuario) devuelve 404 sin llamar al motor", async () => {
    mocks.getAssistantThreadById.mockResolvedValue(null);

    const response = await POST(
      turnRequest({ thread_id: threadId, text: "hola" }),
    );

    expect(response.status).toBe(404);
    expect(mocks.handleWebAssistantTurn).not.toHaveBeenCalled();
  });

  it("un reintento con la misma Idempotency-Key responde 200, no 201", async () => {
    mocks.handleWebAssistantTurn.mockResolvedValue({
      status: "accepted",
      externalEventId: "event-1",
      duplicate: true,
    });

    const response = await POST(turnRequest({ text: "gaste 20 en desayuno" }));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.meta.idempotent_replay).toBe(true);
  });
});
