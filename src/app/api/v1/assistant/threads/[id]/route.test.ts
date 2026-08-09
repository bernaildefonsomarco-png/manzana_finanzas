import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getAssistantThreadById: vi.fn(),
  listAssistantMessages: vi.fn(),
  listRecentAssistantMessages: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/assistant.repository", async (original) => ({
  ...(await original()),
  getAssistantThreadById: mocks.getAssistantThreadById,
  listAssistantMessages: mocks.listAssistantMessages,
  listRecentAssistantMessages: mocks.listRecentAssistantMessages,
}));

import { GET } from "./route";

const THREAD_ID = "0a1eeeb1-0b7f-4dfe-9038-7d90d0b2c0a2";

function context() {
  return { params: Promise.resolve({ id: THREAD_ID }) };
}

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: { rls: true } });
  mocks.getAssistantThreadById.mockResolvedValue({ id: THREAD_ID, status: "activo" });
  mocks.listAssistantMessages.mockResolvedValue([]);
  mocks.listRecentAssistantMessages.mockResolvedValue([]);
});

describe("GET /assistant/threads/[id]", () => {
  it("al abrir la conversacion pide la cola del hilo, no los mensajes mas viejos", async () => {
    // Un hilo de 107 mensajes con limite 100 devolvia los 100 primeros: los 7
    // ultimos turnos quedaban fuera y la pantalla se veia congelada en el
    // pasado aunque el servidor siguiera respondiendo.
    const response = await GET(
      new Request(`http://localhost/api/v1/assistant/threads/${THREAD_ID}?limit=100`),
      context()
    );

    expect(response.status).toBe(200);
    expect(mocks.listRecentAssistantMessages).toHaveBeenCalledWith(
      { rls: true },
      "user-1",
      THREAD_ID,
      { limit: 100 }
    );
    expect(mocks.listAssistantMessages).not.toHaveBeenCalled();
  });

  it("la cola es el final del hilo, asi que no ofrece cursor hacia adelante", async () => {
    mocks.listRecentAssistantMessages.mockResolvedValue([
      { id: "m-1", created_at: "2026-08-09T17:17:20.000Z" },
      { id: "m-2", created_at: "2026-08-09T17:17:30.000Z" },
    ]);

    const response = await GET(
      new Request(`http://localhost/api/v1/assistant/threads/${THREAD_ID}`),
      context()
    );
    const body = (await response.json()) as {
      data: { messages: Array<{ id: string }> };
      meta: { page: { next_cursor: string | null; has_more: boolean } };
    };

    expect(body.data.messages.map((message) => message.id)).toEqual(["m-1", "m-2"]);
    expect(body.meta.page.next_cursor).toBeNull();
    expect(body.meta.page.has_more).toBe(false);
  });

  it("con cursor sigue recorriendo el hilo desde donde quedo", async () => {
    mocks.listAssistantMessages.mockResolvedValue([
      { id: "m-1", created_at: "2026-08-05T06:12:30.000Z" },
    ]);
    const cursor = Buffer.from(
      JSON.stringify({ o: "2026-08-05T06:12:00.000Z", i: "m-0" })
    ).toString("base64url");

    const response = await GET(
      new Request(`http://localhost/api/v1/assistant/threads/${THREAD_ID}?cursor=${cursor}`),
      context()
    );

    expect(response.status).toBe(200);
    expect(mocks.listAssistantMessages).toHaveBeenCalled();
    expect(mocks.listRecentAssistantMessages).not.toHaveBeenCalled();
  });

  it("sin sesion devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(
      new Request(`http://localhost/api/v1/assistant/threads/${THREAD_ID}`),
      context()
    );
    expect(response.status).toBe(401);
  });
});
