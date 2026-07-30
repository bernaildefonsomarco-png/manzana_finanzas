import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";

const mocks = vi.hoisted(() => ({
  commitBudgetOperation: vi.fn(),
  getApiAuth: vi.fn(),
  listBudgetsWithProgress: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  commitBudgetOperation: mocks.commitBudgetOperation,
  listBudgetsWithProgress: mocks.listBudgetsWithProgress,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.listBudgetsWithProgress.mockResolvedValue([]);
  mocks.commitBudgetOperation.mockResolvedValue({
    budget: { id: "22222222-2222-4222-8222-222222222222", amount: 400 },
    idempotent: false,
  });
});

describe("GET /api/v1/budgets", () => {
  it("camino feliz: lista el avance del periodo", async () => {
    mocks.listBudgetsWithProgress.mockResolvedValue([
      { id: "b1", created_at: "2026-07-01T00:00:00Z", spent: 318.5 },
    ]);
    const response = await GET(new Request("http://localhost/api/v1/budgets"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.budgets[0].spent).toBe(318.5);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect(
      (await GET(new Request("http://localhost/api/v1/budgets"))).status
    ).toBe(401);
  });

  it("aislamiento: siempre consulta por el usuario autenticado", async () => {
    await GET(new Request("http://localhost/api/v1/budgets"));
    expect(mocks.listBudgetsWithProgress).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.any(Object)
    );
  });

  it("validación: filtro desconocido devuelve 400", async () => {
    const response = await GET(
      new Request("http://localhost/api/v1/budgets?ajeno=1")
    );
    expect(response.status).toBe(400);
  });

  it("idempotencia de lectura: repetir no ejecuta escritura", async () => {
    const request = () => new Request("http://localhost/api/v1/budgets");
    await GET(request());
    await GET(request());
    expect(mocks.listBudgetsWithProgress).toHaveBeenCalledTimes(2);
    expect(mocks.commitBudgetOperation).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/budgets", () => {
  it("camino feliz: crea por el Core persistido", async () => {
    const response = await POST(createRequest());
    expect(response.status).toBe(201);
    expect(mocks.commitBudgetOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({
        operation: "create",
        idempotencyKey: "budget-create-1",
        payload: expect.objectContaining({
          amount: 400,
          currency: "PEN",
        }),
      })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(createRequest())).status).toBe(401);
    expect(mocks.commitBudgetOperation).not.toHaveBeenCalled();
  });

  it("categoría inexistente se traduce a 404 y no a 500", async () => {
    const { BudgetOperationError } = await import(
      "@/data/repositories/budgets.repository"
    );
    mocks.commitBudgetOperation.mockRejectedValue(
      new BudgetOperationError(
        "BUDGET_NOT_FOUND",
        "No encontre esa categoria."
      )
    );
    expect((await POST(createRequest())).status).toBe(404);
  });

  it("validación: monto cero devuelve 400", async () => {
    expect((await POST(createRequest({ amount: 0 }))).status).toBe(400);
    expect(mocks.commitBudgetOperation).not.toHaveBeenCalled();
  });

  it("idempotencia: replay devuelve 200 y lo declara", async () => {
    mocks.commitBudgetOperation.mockResolvedValue({
      budget: { id: "b1", amount: 400 },
      idempotent: true,
    });
    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

function createRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/v1/budgets", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "budget-create-1",
    },
    body: JSON.stringify({
      amount: 400,
      category_id: "alimentacion",
      period_kind: "mensual",
      kind: "presupuesto",
      ...overrides,
    }),
  });
}
