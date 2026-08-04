import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  suppressAddress: vi.fn(),
  setReminderPreference: vi.fn(),
  verifyUnsubscribeToken: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({ createServiceClient: mocks.createServiceClient }));
vi.mock("@/data/repositories/email-outbox.repository", () => ({ suppressAddress: mocks.suppressAddress }));
vi.mock("@/data/repositories/reminders.repository", () => ({
  setReminderPreference: mocks.setReminderPreference,
}));
vi.mock("@/core/email-outbox/unsubscribe-token", () => ({
  verifyUnsubscribeToken: mocks.verifyUnsubscribeToken,
}));

import { POST } from "./route";

beforeEach(() => {
  mocks.createServiceClient.mockReset().mockReturnValue({ client: true });
  mocks.suppressAddress.mockReset().mockResolvedValue(undefined);
  mocks.setReminderPreference.mockReset().mockResolvedValue(undefined);
  mocks.verifyUnsubscribeToken.mockReset();
});

function request(body: unknown) {
  return new Request("http://localhost/baja/todos", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /baja/todos — ACT-MAIL-04: baja total sin sesión", () => {
  it("camino feliz: suprime la dirección y apaga los diez tipos por correo", async () => {
    mocks.verifyUnsubscribeToken.mockReturnValue({ ok: true, payload: { userId: "user-1", type: "pago_proximo", expiresAt: Date.now() + 1000 } });

    const response = await POST(request({ token: "tok-valido" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({ unsubscribed_all: true });
    expect(mocks.suppressAddress).toHaveBeenCalledWith(
      expect.anything(),
      { userId: "user-1", reason: "baja_total" },
    );
    expect(mocks.setReminderPreference).toHaveBeenCalledTimes(10);
  });

  it("token inválido: 400, no suprime nada", async () => {
    mocks.verifyUnsubscribeToken.mockReturnValue({ ok: false, reason: "firma_invalida" });

    const response = await POST(request({ token: "tok-malo" }));

    expect(response.status).toBe(400);
    expect(mocks.suppressAddress).not.toHaveBeenCalled();
  });

  it("validación: cuerpo sin token se rechaza", async () => {
    const response = await POST(request({}));
    expect(response.status).toBe(400);
    expect(mocks.verifyUnsubscribeToken).not.toHaveBeenCalled();
  });
});
