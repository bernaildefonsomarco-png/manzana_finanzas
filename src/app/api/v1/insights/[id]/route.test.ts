import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { GET as GET_EVIDENCE } from "./evidence/route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getInsightById: vi.fn(),
  getInsightEvidence: vi.fn(),
  getExperiencePreferences: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/experience-preferences.repository", () => ({
  getExperiencePreferences: mocks.getExperiencePreferences,
}));
vi.mock("@/data/repositories/insights.repository", () => ({
  getInsightById: mocks.getInsightById,
  getInsightEvidence: mocks.getInsightEvidence,
  toPublicInsightDetail: (detail: unknown) => detail,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.getExperiencePreferences.mockResolvedValue({ discreet_mode_enabled: false });
  mocks.getInsightById.mockResolvedValue(detail());
  mocks.getInsightEvidence.mockResolvedValue(evidence());
});

describe("GET /insights/[id] y /evidence", () => {
  it("camino feliz: devuelve detalle y aritmetica navegable", async () => {
    const [detailResponse, evidenceResponse] = await Promise.all([
      GET(request(""), context()),
      GET_EVIDENCE(request("/evidence"), context()),
    ]);
    expect(detailResponse.status).toBe(200);
    expect(evidenceResponse.status).toBe(200);
    expect((await evidenceResponse.json()).data.evidence.related_movements).toHaveLength(1);
  });

  it("sin sesion devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(request(""), context())).status).toBe(401);
    expect((await GET_EVIDENCE(request("/evidence"), context())).status).toBe(401);
  });

  it("recurso de otro usuario se normaliza a 404", async () => {
    mocks.getInsightById.mockResolvedValue(null);
    expect((await GET(request(""), context())).status).toBe(404);
    expect((await GET_EVIDENCE(request("/evidence"), context())).status).toBe(404);
  });

  it("error de validacion: id no UUID devuelve 400", async () => {
    const bad = { params: Promise.resolve({ id: "no-uuid" }) };
    expect((await GET(request(""), bad)).status).toBe(400);
    expect((await GET_EVIDENCE(request("/evidence"), bad)).status).toBe(400);
  });

  it("idempotencia de lectura y AC-DESC-06: no expone scores", async () => {
    const first = await (await GET_EVIDENCE(request("/evidence"), context())).json();
    const second = await (await GET_EVIDENCE(request("/evidence"), context())).json();
    expect(first.data).toEqual(second.data);
    expect(JSON.stringify(first)).not.toMatch(/confidence|quality_score|rank_score/);
  });

  it("modo discreto oculta por completo un descubrimiento sensible", async () => {
    mocks.getExperiencePreferences.mockResolvedValue({ discreet_mode_enabled: true });
    mocks.getInsightById.mockResolvedValue(detail({ risk_level: "sensitive" }));
    expect((await GET(request(""), context())).status).toBe(404);
    expect((await GET_EVIDENCE(request("/evidence"), context())).status).toBe(404);
  });
});

const insightId = "11111111-1111-4111-8111-111111111111";
function request(suffix: string) {
  return new Request(`http://localhost/api/v1/insights/${insightId}${suffix}`);
}
function context() { return { params: Promise.resolve({ id: insightId }) }; }
function detail(overrides: Record<string, unknown> = {}) {
  return { insight: { id: insightId, risk_level: "low", ...overrides }, deliveries: [] };
}
function evidence() {
  return {
    insight_id: insightId,
    source_facts: { total: 20 },
    evidence_text: "S/20 en el periodo",
    related_movements: [{ id: "22222222-2222-4222-8222-222222222222" }],
  };
}
