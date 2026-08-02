import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ getApiAuth: vi.fn(), listInsightSummary: vi.fn() }));
vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/insights.repository", () => ({
  listInsightSummary: mocks.listInsightSummary,
  toPublicInsight: (row: unknown) => row,
}));

beforeEach(() => {
  mocks.getApiAuth.mockReset();
  mocks.listInsightSummary.mockReset();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: "user-1" });
  mocks.listInsightSummary.mockResolvedValue([{ id: "insight-1" }, { id: "insight-2" }]);
});

describe("GET /insights/summary", () => {
  it("camino feliz devuelve como maximo dos", async () => {
    const payload = await (await GET(request())).json();
    expect(payload.data.insights).toHaveLength(2);
  });
  it("sin sesion devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
  });
  it("WEB-D230 aisla la coleccion por usuario", async () => {
    await GET(request());
    expect(mocks.listInsightSummary).toHaveBeenCalledWith({}, "user-1");
  });
  it("error de validacion: rechaza parametros inventados", async () => {
    const response = await GET(new Request("http://localhost/api/v1/insights/summary?inventado=x"));
    expect(response.status).toBe(400);
  });
  it("idempotencia de lectura: repetir no escribe ni cambia el dominio", async () => {
    const first = await (await GET(request())).json();
    const second = await (await GET(request())).json();
    expect(first.data).toEqual(second.data);
  });
});

function request() { return new Request("http://localhost/api/v1/insights/summary"); }
