import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(() => ({ service: true })),
  getExperiencePreferences: vi.fn(),
  setExperiencePreferences: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/experience-preferences.repository", () => ({
  getExperiencePreferences: mocks.getExperiencePreferences,
  setExperiencePreferences: mocks.setExperiencePreferences,
}));

import { GET, PUT } from "./route";

const preferences = {
  discreet_mode_enabled: true,
  insights_whatsapp_opt_in: false,
  weekly_summary_enabled: true,
  weekly_summary_channel: "dashboard",
};

beforeEach(() => {
  mocks.getApiAuth.mockReset().mockResolvedValue({
    userId: "user-1",
    client: { rls: true },
  });
  mocks.createServiceClient.mockReturnValue({ service: true });
  mocks.getExperiencePreferences.mockReset().mockResolvedValue(preferences);
  mocks.setExperiencePreferences.mockReset().mockResolvedValue(preferences);
});

describe("experience preferences route", () => {
  it("lee la preferencia global bajo RLS", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/preferences/experience"),
    );
    expect(response.status).toBe(200);
    expect(mocks.getExperiencePreferences).toHaveBeenCalledWith(
      { rls: true },
      "user-1",
    );
  });

  it("persiste consentimiento granular por ruta gobernada", async () => {
    const response = await PUT(
      new Request("http://localhost/api/v1/preferences/experience", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preferences),
      }),
    );
    expect(response.status).toBe(200);
    expect(mocks.setExperiencePreferences).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({ userId: "user-1", preferences }),
    );
  });
});
