import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createAssistantThread: vi.fn(),
  listAssistantThreads: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/assistant.repository", async (original) => ({
  ...(await original()),
  createAssistantThread: mocks.createAssistantThread,
  listAssistantThreads: mocks.listAssistantThreads,
}));

import { GET, POST } from "./route";

const userId = "11111111-1111-4111-8111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ userId, client: {} });
});

describe("GET /api/v1/assistant/threads", () => {
  it("requiere sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(
      new Request("http://localhost/api/v1/assistant/threads"),
    );
    expect(response.status).toBe(401);
    expect(mocks.listAssistantThreads).not.toHaveBeenCalled();
  });

  it("lista los hilos del usuario, mas reciente primero", async () => {
    mocks.listAssistantThreads.mockResolvedValue([
      { id: "t1", updated_at: "2026-08-03T10:00:00.000Z" },
    ]);

    const response = await GET(
      new Request("http://localhost/api/v1/assistant/threads"),
    );

    expect(response.status).toBe(200);
    expect(mocks.listAssistantThreads).toHaveBeenCalledWith(
      {},
      userId,
      expect.objectContaining({ limit: expect.any(Number) }),
    );
    const body = await response.json();
    expect(body.data.threads).toHaveLength(1);
  });

  it("un cursor invalido devuelve VALIDATION_ERROR sin consultar", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/assistant/threads?cursor=no-es-base64url-valido!!"),
    );
    expect(response.status).toBe(400);
    expect(mocks.listAssistantThreads).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/assistant/threads", () => {
  it("crea un hilo nuevo", async () => {
    mocks.createAssistantThread.mockResolvedValue({ id: "t1", title: null });

    const response = await POST(
      new Request("http://localhost/api/v1/assistant/threads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(201);
    expect(mocks.createAssistantThread).toHaveBeenCalledWith({}, userId, null);
  });
});
