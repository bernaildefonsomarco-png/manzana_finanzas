import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getReminderPreferences: vi.fn(),
  getReminderPause: vi.fn(),
  setReminderPreference: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/reminders.repository", async (original) => ({
  ...(await original()),
  getReminderPreferences: mocks.getReminderPreferences,
  getReminderPause: mocks.getReminderPause,
  setReminderPreference: mocks.setReminderPreference,
}));

import { GET, PATCH } from "./route";

const auth = { userId: "user-1", client: { rls: true } };

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue(auth);
  mocks.getReminderPreferences.mockResolvedValue([]);
  mocks.getReminderPause.mockResolvedValue(null);
  mocks.setReminderPreference.mockResolvedValue(undefined);
});

describe("GET /reminder-preferences", () => {
  it("responde 200 con las preferencias y la pausa vigente", async () => {
    const res = await GET(new Request("http://localhost/api/v1/reminder-preferences"));
    expect(res.status).toBe(200);
  });
  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://localhost/api/v1/reminder-preferences"));
    expect(res.status).toBe(401);
  });
});

describe("PATCH /reminder-preferences — cinco casos", () => {
  const request = (body: unknown) =>
    new Request("http://localhost/api/v1/reminder-preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const validBody = { nudge_type: "cuota_proxima", channel: "email", enabled: true };

  it("activa el correo de un tipo", async () => {
    const res = await PATCH(request(validBody));
    expect(res.status).toBe(200);
    expect(mocks.setReminderPreference).toHaveBeenCalledWith(auth.client, auth.userId, {
      nudgeType: "cuota_proxima",
      channel: "email",
      enabled: true,
    });
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await PATCH(request(validBody));
    expect(res.status).toBe(401);
  });

  it("no acepta escribir preferencias de otro usuario: el userId sale de la sesión", async () => {
    await PATCH(request({ ...validBody, user_id: "otro-usuario" }));
    // El schema .strict() rechaza cualquier campo no declarado, incluido un
    // intento de inyectar user_id en el cuerpo.
    const res = await PATCH(request({ ...validBody, user_id: "otro-usuario" }));
    expect(res.status).toBe(400);
  });

  it("rechaza un nudge_type o canal desconocido", async () => {
    const res = await PATCH(request({ nudge_type: "no_existe", channel: "email", enabled: true }));
    expect(res.status).toBe(400);
  });

  it("es idempotente: repetir la misma preferencia no falla", async () => {
    await PATCH(request(validBody));
    const res = await PATCH(request(validBody));
    expect(res.status).toBe(200);
  });
});
