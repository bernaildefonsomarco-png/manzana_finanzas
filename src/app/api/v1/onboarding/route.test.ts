import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  deriveInitialOnboardingSummary: vi.fn(),
  getApiAuth: vi.fn(),
  getInitialOnboardingFacts: vi.fn(),
  getProfile: vi.fn(),
  startInitialOnboarding: vi.fn(),
  upsertProfile: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock("@/data/repositories/onboarding.repository", () => ({
  getInitialOnboardingFacts: mocks.getInitialOnboardingFacts,
}));
vi.mock("@/data/repositories/profiles.repository", () => ({
  getProfile: mocks.getProfile,
  upsertProfile: mocks.upsertProfile,
}));
vi.mock("@/core/onboarding/onboarding-activation", () => ({
  deriveInitialOnboardingSummary: mocks.deriveInitialOnboardingSummary,
  startInitialOnboarding: mocks.startInitialOnboarding,
}));

import { GET, POST } from "./route";

const profile = {
  id: "11111111-1111-4111-8111-111111111111",
  display_name: null,
  phone_e164: null,
  timezone: "America/Lima",
  locale: "es-PE",
  default_currency: "PEN",
  onboarding_status: "not_started",
  created_at: "2026-07-22T00:00:00.000Z",
  updated_at: "2026-07-22T00:00:00.000Z",
};

describe("/api/v1/onboarding", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.createServiceClient.mockReturnValue({ service: true });
    mocks.getApiAuth.mockResolvedValue({
      client: { auth: true },
      userId: profile.id,
    });
    mocks.getProfile.mockResolvedValue(profile);
    mocks.getInitialOnboardingFacts.mockResolvedValue({
      confirmedMovementsCount: 0,
      debtsCount: 0,
    });
    mocks.deriveInitialOnboardingSummary.mockReturnValue({
      persisted_status: "not_started",
      effective_status: "not_started",
      stage: "registered_without_use",
      first_value_kind: null,
      show_initial_prompt: true,
      show_first_value_tip: false,
    });
    mocks.startInitialOnboarding.mockResolvedValue({
      changed: true,
      previous_status: "not_started",
      current_status: "started",
      reason: "advanced",
    });
  });

  it("lee un snapshot sin mutar el onboarding", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/onboarding")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.onboarding.show_initial_prompt).toBe(true);
    expect(mocks.startInitialOnboarding).not.toHaveBeenCalled();
    expect(mocks.deriveInitialOnboardingSummary).toHaveBeenCalledWith({
      persistedStatus: "not_started",
      confirmedMovementsCount: 0,
      debtsCount: 0,
    });
  });

  it("inicia explicitamente y no acepta un status arbitrario del cliente", async () => {
    mocks.getProfile.mockResolvedValue({
      ...profile,
      onboarding_status: "started",
    });
    const response = await POST(
      new Request("http://localhost/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start", source: "dashboard_home" }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.startInitialOnboarding).toHaveBeenCalledWith(
      { service: true },
      expect.objectContaining({
        userId: profile.id,
        source: "dashboard_home",
      })
    );

    const invalid = await POST(
      new Request("http://localhost/api/v1/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          source: "dashboard_home",
        }),
      })
    );
    expect(invalid.status).toBe(400);
  });

  it("exige autenticacion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/onboarding")
    );

    expect(response.status).toBe(401);
  });
});
