import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  listBudgetSuggestions: vi.fn(),
  resolveBudgetSuggestion: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  listBudgetSuggestions: mocks.listBudgetSuggestions,
  resolveBudgetSuggestion: mocks.resolveBudgetSuggestion,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.listBudgetSuggestions.mockResolvedValue([
    { id: "bs_alimentacion_mensual_2026-04-01_2026-06-30" },
  ]);
});

describe("GET /api/v1/budgets/suggestions", () => {
  it("camino feliz", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect((await response.json()).data.suggestions).toHaveLength(1);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(request())).status).toBe(401);
  });

  it("aislamiento: consulta solo el historial propio", async () => {
    await GET(request());
    expect(mocks.listBudgetSuggestions).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.any(Object)
    );
  });

  it("validación: filtro desconocido devuelve 400", async () => {
    expect(
      (
        await GET(
          new Request(
            "http://localhost/api/v1/budgets/suggestions?usuario=ajeno"
          )
        )
      ).status
    ).toBe(400);
  });

  it("idempotencia de lectura: repetir no resuelve sugerencias", async () => {
    await GET(request());
    await GET(request());
    expect(mocks.listBudgetSuggestions).toHaveBeenCalledTimes(2);
    expect(mocks.resolveBudgetSuggestion).not.toHaveBeenCalled();
  });
});

function request() {
  return new Request("http://localhost/api/v1/budgets/suggestions");
}
