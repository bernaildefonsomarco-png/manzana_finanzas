import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listReminders: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/reminders.repository", async (original) => ({
  ...(await original()),
  listReminders: mocks.listReminders,
}));

import { GET } from "./route";

const auth = { userId: "user-1", client: { rls: true } };
const reminder = {
  id: "r1",
  kind: "pago_proximo",
  title: "El alquiler vence el viernes",
  body: "Puedes registrarlo cuando lo pagues.",
  action_url: "/pagos-que-vienen",
  status: "en_bandeja",
  created_at: "2026-08-01T00:00:00Z",
  expires_at: "2026-08-31T00:00:00Z",
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue(auth);
  mocks.listReminders.mockResolvedValue([reminder]);
});

describe("GET /reminders — colección, aislamiento por WEB-D230", () => {
  it("devuelve los recordatorios abiertos del usuario", async () => {
    const res = await GET(new Request("http://localhost/api/v1/reminders"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.reminders).toHaveLength(1);
    expect(mocks.listReminders).toHaveBeenCalledWith(auth.client, auth.userId, { estado: undefined });
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/v1/reminders"));
    expect(res.status).toBe(401);
  });

  it("nunca pide ni filtra por otro usuario: el userId siempre sale de la sesión, no de query params", async () => {
    await GET(new Request("http://localhost/api/v1/reminders?estado=abiertos"));
    expect(mocks.listReminders).toHaveBeenCalledWith(auth.client, auth.userId, { estado: "abiertos" });
  });

  it("rechaza parámetros de query desconocidos (esquema .strict())", async () => {
    const res = await GET(new Request("http://localhost/api/v1/reminders?otro=1"));
    expect(res.status).toBe(400);
  });

  it("es una lectura pura: repetirla no cambia nada", async () => {
    await GET(new Request("http://localhost/api/v1/reminders"));
    await GET(new Request("http://localhost/api/v1/reminders"));
    expect(mocks.listReminders).toHaveBeenCalledTimes(2);
    expect(mocks.listReminders).toHaveBeenNthCalledWith(1, auth.client, auth.userId, { estado: undefined });
    expect(mocks.listReminders).toHaveBeenNthCalledWith(2, auth.client, auth.userId, { estado: undefined });
  });
});
