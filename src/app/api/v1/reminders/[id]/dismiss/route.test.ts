import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  dismissReminder: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/reminders.repository", async (original) => ({
  ...(await original()),
  dismissReminder: mocks.dismissReminder,
}));

import { ReminderRepositoryError } from "@/data/repositories/reminders.repository";
import { POST } from "./route";

const id = "11111111-1111-4111-8111-111111111111";
const context = (value = id) => ({ params: Promise.resolve({ id: value }) });
const auth = { userId: "user-1", client: { rls: true } };

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue(auth);
  mocks.dismissReminder.mockResolvedValue(undefined);
});

describe("POST /reminders/[id]/dismiss — cinco casos", () => {
  it("descarta el recordatorio", async () => {
    const res = await POST(new Request(`http://localhost/api/v1/reminders/${id}/dismiss`, { method: "POST" }), context());
    expect(res.status).toBe(200);
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const res = await POST(new Request(`http://localhost/api/v1/reminders/${id}/dismiss`, { method: "POST" }), context());
    expect(res.status).toBe(401);
  });

  it("un recurso ajeno devuelve 404, nunca 403 (WEB-D230)", async () => {
    mocks.dismissReminder.mockRejectedValue(new ReminderRepositoryError("FORBIDDEN", "no autorizado"));
    const res = await POST(new Request(`http://localhost/api/v1/reminders/${id}/dismiss`, { method: "POST" }), context());
    expect(res.status).toBe(404);
  });

  it("rechaza un id inválido", async () => {
    const res = await POST(new Request("http://localhost/api/v1/reminders/no/dismiss", { method: "POST" }), context("no"));
    expect(res.status).toBe(400);
  });

  it("ERR-NOTIF-04: descartar uno ya resuelto es un conflicto, no un éxito silencioso", async () => {
    mocks.dismissReminder.mockRejectedValue(new ReminderRepositoryError("CONFLICT", "Eso ya está resuelto."));
    const res = await POST(new Request(`http://localhost/api/v1/reminders/${id}/dismiss`, { method: "POST" }), context());
    expect(res.status).toBe(409);
  });

  it("descartar dos veces el mismo recordatorio abierto es idempotente (no lanza)", async () => {
    await POST(new Request(`http://localhost/api/v1/reminders/${id}/dismiss`, { method: "POST" }), context());
    const res = await POST(new Request(`http://localhost/api/v1/reminders/${id}/dismiss`, { method: "POST" }), context());
    expect(res.status).toBe(200);
  });
});
