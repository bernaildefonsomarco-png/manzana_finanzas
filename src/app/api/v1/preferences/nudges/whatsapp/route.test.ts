import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PUT } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({ service: true })),
  getApiAuth: vi.fn(),
  getWhatsAppNudgeConsent: vi.fn(),
  setWhatsAppNudgeConsent: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/nudges.repository", () => ({
  getWhatsAppNudgeConsent: mocks.getWhatsAppNudgeConsent,
  setWhatsAppNudgeConsent: mocks.setWhatsAppNudgeConsent,
}));

const userId = "11111111-1111-4111-8111-111111111111";
const consent = {
  whatsapp_opt_in: true,
  payment_due: true,
  debt_due: false,
  quiet_hours_start: "22:00",
  quiet_hours_end: "08:00",
  configured: true,
};

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createServiceClient.mockReturnValue({ service: true });
  mocks.getWhatsAppNudgeConsent.mockResolvedValue(consent);
  mocks.setWhatsAppNudgeConsent.mockResolvedValue(consent);
});

describe("WhatsApp nudge consent route", () => {
  it("rechaza lectura sin sesión", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/preferences/nudges/whatsapp"),
    );

    expect(response.status).toBe(401);
    expect(mocks.getWhatsAppNudgeConsent).not.toHaveBeenCalled();
  });

  it("devuelve el consentimiento externo separado del Dashboard", async () => {
    const client = {};
    mocks.getApiAuth.mockResolvedValue({ client, userId });

    const response = await GET(
      new Request("http://localhost/api/v1/preferences/nudges/whatsapp"),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.consent).toEqual(consent);
    expect(mocks.getWhatsAppNudgeConsent).toHaveBeenCalledWith(client, userId);
  });

  it("registra consentimiento explícito y reversible", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId });
    const input = {
      whatsapp_opt_in: true,
      payment_due: true,
      debt_due: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
    };

    const response = await PUT(
      new Request("http://localhost/api/v1/preferences/nudges/whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.setWhatsAppNudgeConsent).toHaveBeenCalledWith(
      { service: true },
      userId,
      input,
      expect.any(String),
    );
  });

  it("no activa el canal sin al menos un tipo autorizado", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId });

    const response = await PUT(
      new Request("http://localhost/api/v1/preferences/nudges/whatsapp", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          whatsapp_opt_in: true,
          payment_due: false,
          debt_due: false,
          quiet_hours_start: "22:00",
          quiet_hours_end: "08:00",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.setWhatsAppNudgeConsent).not.toHaveBeenCalled();
  });
});
