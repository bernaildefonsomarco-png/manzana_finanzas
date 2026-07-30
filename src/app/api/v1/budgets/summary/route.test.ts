import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  commitBudgetOperation: vi.fn(),
  getApiAuth: vi.fn(),
  getBudgetSummary: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  commitBudgetOperation: mocks.commitBudgetOperation,
  getBudgetSummary: mocks.getBudgetSummary,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.getBudgetSummary.mockResolvedValue({ total: 4, top: [{ id: "b1" }] });
});

describe("GET /api/v1/budgets/summary", () => {
  it("camino feliz: devuelve máximo tres", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.summary.top).toHaveLength(1);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
  });

  it("aislamiento: usa el usuario autenticado", async () => {
    await GET(request());
    expect(mocks.getBudgetSummary).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.any(Object)
    );
  });

  it("validación: filtro desconocido devuelve 400", async () => {
    expect(
      (
        await GET(
          new Request("http://localhost/api/v1/budgets/summary?score=1")
        )
      ).status
    ).toBe(400);
  });

  it("idempotencia de lectura: repetir no escribe", async () => {
    await GET(request());
    await GET(request());
    expect(mocks.getBudgetSummary).toHaveBeenCalledTimes(2);
    expect(mocks.commitBudgetOperation).not.toHaveBeenCalled();
  });
});

function request() {
  return new Request("http://localhost/api/v1/budgets/summary");
}
