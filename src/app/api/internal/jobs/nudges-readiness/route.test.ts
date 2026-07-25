import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({ service: true })),
  checkKapsoTemplateReadiness: vi.fn(),
  getProactivePilotMetrics: vi.fn(),
  getProactiveNudgeUserOperationalState: vi.fn(),
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/adapters/whatsapp/kapso-template-readiness", async () => {
  const actual = await vi.importActual<
    typeof import("@/adapters/whatsapp/kapso-template-readiness")
  >("@/adapters/whatsapp/kapso-template-readiness");
  return {
    ...actual,
    checkKapsoTemplateReadiness: mocks.checkKapsoTemplateReadiness,
  };
});

vi.mock("@/data/repositories/proactive-nudge-operations.repository", () => ({
  getProactivePilotMetrics: mocks.getProactivePilotMetrics,
  getProactiveNudgeUserOperationalState:
    mocks.getProactiveNudgeUserOperationalState,
}));

const pilotUserId = "11111111-1111-4111-8111-111111111111";
const envKeys = [
  "APP_ENV",
  "CRON_SECRET",
  "WORKER_SECRET",
  "WHATSAPP_PROVIDER",
  "KAPSO_API_KEY",
  "KAPSO_WHATSAPP_PHONE_NUMBER_ID",
  "KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID",
  "WHATSAPP_NUDGE_TEMPLATE_NAME",
  "WHATSAPP_NUDGE_TEMPLATE_LANGUAGE",
  "WHATSAPP_PROACTIVE_NUDGE_MODE",
  "WHATSAPP_PROACTIVE_NUDGE_PILOT_USER_IDS",
  "WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED",
  "WHATSAPP_PROACTIVE_TEMPLATE_APPROVED",
  "WHATSAPP_SEND_PROACTIVE_NUDGES",
] as const;
const originalEnv = Object.fromEntries(
  envKeys.map((key) => [key, process.env[key]]),
);

beforeEach(() => {
  process.env.APP_ENV = "production";
  process.env.CRON_SECRET = "cron-secret";
  delete process.env.WORKER_SECRET;
  process.env.WHATSAPP_PROVIDER = "kapso";
  process.env.KAPSO_API_KEY = "secret-kapso-key";
  process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID = "phone-secret-id";
  process.env.KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID = "waba-secret-id";
  process.env.WHATSAPP_NUDGE_TEMPLATE_NAME = "manzana_payment_due";
  process.env.WHATSAPP_NUDGE_TEMPLATE_LANGUAGE = "es_PE";
  process.env.WHATSAPP_PROACTIVE_NUDGE_MODE = "planned";
  process.env.WHATSAPP_PROACTIVE_NUDGE_PILOT_USER_IDS = pilotUserId;
  process.env.WHATSAPP_PROACTIVE_PAYMENT_METHOD_CONFIRMED = "true";
  process.env.WHATSAPP_PROACTIVE_TEMPLATE_APPROVED = "true";
  process.env.WHATSAPP_SEND_PROACTIVE_NUDGES = "false";

  mocks.createServiceClient.mockClear();
  mocks.checkKapsoTemplateReadiness.mockReset();
  mocks.checkKapsoTemplateReadiness.mockResolvedValue({
    checked: true,
    ready: true,
    found: true,
    template_name: "manzana_payment_due",
    language: "es_PE",
    status: "APPROVED",
    category: "UTILITY",
    reason: "template_approved_live",
    checked_at: "2026-07-20T12:00:00.000Z",
  });
  mocks.getProactivePilotMetrics.mockReset();
  mocks.getProactivePilotMetrics.mockResolvedValue({
    window_days: 7,
    scope_users: 1,
    candidates: { total: 0, by_status: {}, by_type: {} },
    deliveries: { total: 0, by_status: {} },
  });
  mocks.getProactiveNudgeUserOperationalState.mockReset();
  mocks.getProactiveNudgeUserOperationalState.mockResolvedValue({
    phone_linked: true,
    timezone: "America/Lima",
    consent: {
      whatsapp_opt_in: true,
      payment_due: true,
      debt_due: false,
      quiet_hours_start: "22:00",
      quiet_hours_end: "08:00",
      configured: true,
    },
  });
});

afterEach(() => {
  for (const key of envKeys) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("proactive nudges readiness route", () => {
  it("reporta configuracion lista sin activar envios", async () => {
    const response = await GET(
      new Request(
        `http://localhost/api/internal/jobs/nudges-readiness?user_id=${pilotUserId}&window_days=7`,
        { headers: { authorization: "Bearer cron-secret" } },
      ),
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.read_only).toBe(true);
    expect(payload.data.global.configuration_ready).toBe(true);
    expect(payload.data.global.sending_active).toBe(false);
    expect(payload.data.activation.mode).toBe("planned");
    expect(payload.data.user.pilot_ready).toBe(true);
    expect(mocks.getProactivePilotMetrics).toHaveBeenCalledWith(
      { service: true },
      [pilotUserId],
      7,
    );

    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain("secret-kapso-key");
    expect(serialized).not.toContain("waba-secret-id");
    expect(serialized).not.toContain("phone-secret-id");
  });

  it("rechaza consultas no autenticadas fuera de local", async () => {
    const response = await GET(
      new Request("http://localhost/api/internal/jobs/nudges-readiness"),
    );

    expect(response.status).toBe(403);
    expect(mocks.checkKapsoTemplateReadiness).not.toHaveBeenCalled();
    expect(mocks.createServiceClient).not.toHaveBeenCalled();
  });
});
