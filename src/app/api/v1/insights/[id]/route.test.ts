import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { GET as GET_EVIDENCE } from "./evidence/route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getInsightById: vi.fn(),
  getInsightEvidence: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/insights.repository", () => ({
  getInsightById: mocks.getInsightById,
  getInsightEvidence: mocks.getInsightEvidence,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("insight detail routes", () => {
  it("devuelve detalle y trazabilidad del usuario", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
    mocks.getInsightById.mockResolvedValue({
      insight: { id: insightId },
      deliveries: [],
    });
    const response = await GET(request(""), context());
    expect(response.status).toBe(200);
    expect((await response.json()).data.insight.id).toBe(insightId);
  });

  it("no expone evidencia de un insight inexistente", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
    mocks.getInsightEvidence.mockResolvedValue(null);
    const response = await GET_EVIDENCE(request("/evidence"), context());
    expect(response.status).toBe(404);
  });

  it("devuelve hechos seguros sin razonamiento interno", async () => {
    mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
    mocks.getInsightEvidence.mockResolvedValue({
      insight_id: insightId,
      source_facts: { total: 20 },
      evidence_text: "S/20 en el periodo",
    });
    const response = await GET_EVIDENCE(request("/evidence"), context());
    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.data.evidence.source_facts).toEqual({ total: 20 });
    expect(JSON.stringify(payload)).not.toContain("chain_of_thought");
  });
});

const insightId = "11111111-1111-4111-8111-111111111111";
function request(suffix: string) {
  return new Request(`http://localhost/api/v1/insights/${insightId}${suffix}`);
}
function context() {
  return { params: Promise.resolve({ id: insightId }) };
}
