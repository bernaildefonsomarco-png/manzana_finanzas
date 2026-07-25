import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(() => ({ service: true })),
  evaluateDashboardNudges: vi.fn(),
  getApiAuth: vi.fn(),
  listDashboardNudgePreferences: vi.fn(),
  setDashboardNudgePreference: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/nudges.repository", () => ({
  evaluateDashboardNudges: mocks.evaluateDashboardNudges,
  listDashboardNudgePreferences: mocks.listDashboardNudgePreferences,
  setDashboardNudgePreference: mocks.setDashboardNudgePreference,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createServiceClient.mockReturnValue({ service: true });
  mocks.evaluateDashboardNudges.mockResolvedValue({
    generated: 0,
    inserted: 0,
    updated: 0,
    skipped: 0,
    expired: 0,
    candidates: [],
  });
  mocks.listDashboardNudgePreferences.mockResolvedValue([
    {
      nudge_type: "payment_due",
      enabled: true,
      configured: false,
      channel: "dashboard",
      paused_until: null,
    },
    {
      nudge_type: "debt_due",
      enabled: true,
      configured: true,
      channel: "dashboard",
      paused_until: null,
    },
  ]);
});

describe("dashboard nudge preferences route", () => {
  it("rechaza lectura sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/preferences/nudges")
    );

    expect(response.status).toBe(401);
    expect(mocks.listDashboardNudgePreferences).not.toHaveBeenCalled();
  });

  it("devuelve preferencias efectivas del usuario", async () => {
    const client = {};
    mocks.getApiAuth.mockResolvedValue({
      client,
      userId: "11111111-1111-4111-8111-111111111111",
    });

    const response = await GET(
      new Request("http://localhost/api/v1/preferences/nudges")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.preferences).toHaveLength(2);
    expect(mocks.listDashboardNudgePreferences).toHaveBeenCalledWith(
      client,
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("guarda debt_due y refresca los avisos al activarlo", async () => {
    const userId = "11111111-1111-4111-8111-111111111111";
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId });
    mocks.setDashboardNudgePreference.mockResolvedValue({});

    const response = await POST(
      new Request("http://localhost/api/v1/preferences/nudges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nudge_type: "debt_due",
          enabled: true,
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.refreshed).toBe(true);
    expect(mocks.setDashboardNudgePreference).toHaveBeenCalledWith(
      { service: true },
      userId,
      "debt_due",
      true
    );
    expect(mocks.evaluateDashboardNudges).toHaveBeenCalledWith(
      { service: true },
      userId,
      { traceId: expect.any(String) }
    );
  });

  it("rechaza tipos fuera del contrato", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: {},
      userId: "11111111-1111-4111-8111-111111111111",
    });

    const response = await POST(
      new Request("http://localhost/api/v1/preferences/nudges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nudge_type: "reengagement",
          enabled: true,
        }),
      })
    );

    expect(response.status).toBe(400);
    expect(mocks.setDashboardNudgePreference).not.toHaveBeenCalled();
  });
});
