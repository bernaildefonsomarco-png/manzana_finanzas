import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));

import { GET, POST } from "./route";

function makeClient(overrides: Partial<{ insertError: { message: string } | null }> = {}) {
  const insert = vi.fn().mockResolvedValue({ error: overrides.insertError ?? null });
  const order = vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue({
      data: [{ id: "e1", kind: "creada", created_at: "2026-08-03T00:00:00Z" }],
      error: null,
    }),
  });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { from: vi.fn().mockReturnValue({ insert, select }), insert, select, eq, order };
}

beforeEach(() => {
  mocks.getApiAuth.mockReset();
});

describe("POST /api/v1/auth/events — cuenta.creada", () => {
  it("camino feliz: registra el evento con la sesión del propio usuario", async () => {
    const client = makeClient();
    mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client });

    const response = await POST(
      new Request("http://localhost/api/v1/auth/events", {
        method: "POST",
        headers: { "content-type": "application/json", "user-agent": "vitest" },
        body: JSON.stringify({ kind: "creada" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(client.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "user-1", kind: "creada" }),
    );
  });

  it("sin sesión: 401, no escribe nada", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await POST(
      new Request("http://localhost/api/v1/auth/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "creada" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("validación: un kind fuera del literal permitido se rechaza", async () => {
    const client = makeClient();
    mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client });

    const response = await POST(
      new Request("http://localhost/api/v1/auth/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "eliminacion_solicitada" }),
      }),
    );

    expect(response.status).toBe(400);
    expect(client.insert).not.toHaveBeenCalled();
  });
});

describe("GET /api/v1/auth/events — historial (43 §4.3, ACT solo lectura)", () => {
  it("camino feliz: devuelve el historial ordenado, acotado a 50", async () => {
    const client = makeClient();
    mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client });

    const response = await GET(new Request("http://localhost/api/v1/auth/events"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.events).toHaveLength(1);
    expect(client.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("sin sesión: 401, sin filtrar si el recurso existe", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/auth/events"));
    expect(response.status).toBe(401);
  });
});
