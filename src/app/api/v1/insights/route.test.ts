import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getExperiencePreferences: vi.fn(),
  listInsights: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/experience-preferences.repository", () => ({
  getExperiencePreferences: mocks.getExperiencePreferences,
}));
vi.mock("@/data/repositories/insights.repository", () => ({
  listInsights: mocks.listInsights,
  toPublicInsight: (row: Record<string, unknown>) => ({
    id: row.id,
    type: row.type,
    title: row.title,
    evidence_refs: row.source_entity_ids,
  }),
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.getExperiencePreferences.mockResolvedValue({ discreet_mode_enabled: false });
  mocks.listInsights.mockResolvedValue([candidate()]);
});

describe("GET /insights", () => {
  it("camino feliz: limita la superficie a cinco y aplica filtros", async () => {
    const response = await GET(new Request("http://localhost/api/v1/insights?limit=50&type=projection"));
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.insights).toHaveLength(1);
    expect(mocks.listInsights).toHaveBeenCalledWith({}, "user-1", expect.objectContaining({
      limit: 6,
      type: "projection",
      includeExpired: false,
      excludeSensitive: false,
    }));
  });

  it("sin sesion devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/api/v1/insights"));
    expect(response.status).toBe(401);
    expect(mocks.listInsights).not.toHaveBeenCalled();
  });

  it("WEB-D230: una coleccion se aisla por user_id sin inventar un 404", async () => {
    const response = await GET(new Request("http://localhost/api/v1/insights"));
    expect(response.status).toBe(200);
    expect(mocks.listInsights).toHaveBeenCalledWith({}, "user-1", expect.any(Object));
  });

  it("error de validacion: rechaza filtros desconocidos", async () => {
    const response = await GET(new Request("http://localhost/api/v1/insights?inventado=x"));
    expect(response.status).toBe(400);
    expect(mocks.listInsights).not.toHaveBeenCalled();
  });

  it("idempotencia de lectura y AC-DESC-06: repite dominio sin scores internos", async () => {
    const request = () => GET(new Request("http://localhost/api/v1/insights"));
    const first = await (await request()).json();
    const second = await (await request()).json();
    expect(first.data).toEqual(second.data);
    const serialized = JSON.stringify(first);
    expect(serialized).not.toContain("confidence");
    expect(serialized).not.toContain("quality_score");
    expect(serialized).not.toContain("rank_score");
  });
});

function candidate() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    type: "projection",
    title: "Asi vendria el cierre",
    source_entity_ids: ["22222222-2222-4222-8222-222222222222"],
    rank_score: 99,
    quality_score: 98,
    confidence: 1,
    created_at: "2026-08-01T12:00:00.000Z",
  };
}
