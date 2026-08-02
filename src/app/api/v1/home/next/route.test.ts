import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listReminders: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/reminders.repository", () => ({ listReminders: mocks.listReminders }));

import { GET } from "./route";

const auth = { userId: "user-1", client: { rls: true } };

function reminder(overrides: Record<string, unknown>) {
  return {
    id: "r1",
    kind: "pago_proximo",
    title: "t",
    body: "b",
    action_url: "/pagos-que-vienen",
    status: "en_bandeja",
    created_at: "2026-08-01T00:00:00.000Z",
    expires_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("GET /home/next — cinco casos (WEB-D230: colección sin recurso identificable)", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getApiAuth.mockResolvedValue(auth);
    mocks.listReminders.mockResolvedValue([]);
  });

  it("sin recordatorios de nivel 1-4, next_action es null", async () => {
    const res = await GET(new Request("http://localhost/api/v1/home/next"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.next_action).toBeNull();
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/v1/home/next"));
    expect(res.status).toBe(401);
  });

  it("con un candidato válido, lo devuelve", async () => {
    mocks.listReminders.mockResolvedValue([reminder({ kind: "cuota_vencida" })]);
    const res = await GET(new Request("http://localhost/api/v1/home/next"));
    const body = await res.json();
    expect(body.data.next_action.id).toBe("r1");
  });

  it("WEB-D230: solo lee del usuario autenticado, ignora cualquier parámetro de otro", async () => {
    await GET(new Request("http://localhost/api/v1/home/next?user_id=otro"));
    expect(mocks.listReminders).toHaveBeenCalledWith(auth.client, "user-1", { estado: "abiertos" });
  });

  it("idempotente: dos llamadas devuelven el mismo resultado sin mutar nada", async () => {
    mocks.listReminders.mockResolvedValue([reminder({ kind: "correo_desconectado" })]);
    const first = await (await GET(new Request("http://localhost/api/v1/home/next"))).json();
    const second = await (await GET(new Request("http://localhost/api/v1/home/next"))).json();
    expect(first.data).toEqual(second.data);
  });

  it("no cacheable: private, no-store", async () => {
    const res = await GET(new Request("http://localhost/api/v1/home/next"));
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });
});
