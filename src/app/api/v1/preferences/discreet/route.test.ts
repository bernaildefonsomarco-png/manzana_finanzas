import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getExperiencePreferences: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/experience-preferences.repository", () => ({
  getExperiencePreferences: mocks.getExperiencePreferences,
}));

import { GET } from "./route";

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.getExperiencePreferences.mockReset();
});

describe("GET /api/v1/preferences/discreet — AC-CONF-03: punto único de decisión", () => {
  it("camino feliz: devuelve solo discreet_mode_enabled, leído del mismo resolvedor que el layout", async () => {
    mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: { rls: true } });
    mocks.getExperiencePreferences.mockResolvedValue({
      discreet_mode_enabled: true,
      insights_whatsapp_opt_in: false,
      weekly_summary_enabled: false,
      weekly_summary_channel: "dashboard",
      theme_preference: "system",
    });

    const response = await GET(new Request("http://localhost/api/v1/preferences/discreet"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      data: { discreet_mode_enabled: true },
      meta: expect.any(Object),
    });
    expect(mocks.getExperiencePreferences).toHaveBeenCalledWith({ rls: true }, "user-1");
  });

  it("sin sesión: 401, sin filtrar si el usuario existe", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/v1/preferences/discreet"));

    expect(response.status).toBe(401);
    expect(mocks.getExperiencePreferences).not.toHaveBeenCalled();
  });

  it("un fallo del resolvedor no expone el detalle interno", async () => {
    mocks.getApiAuth.mockResolvedValue({ userId: "user-1", client: { rls: true } });
    mocks.getExperiencePreferences.mockRejectedValue(new Error("conexión perdida"));

    const response = await GET(new Request("http://localhost/api/v1/preferences/discreet"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("conexión perdida");
  });
});
