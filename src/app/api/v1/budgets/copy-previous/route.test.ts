import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  commitBudgetOperation: vi.fn(),
  getApiAuth: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  commitBudgetOperation: mocks.commitBudgetOperation,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.commitBudgetOperation.mockResolvedValue({
    budgets: [{ id: "b1" }],
    budget: null,
    idempotent: false,
  });
});

describe("POST /api/v1/budgets/copy-previous", () => {
  it("camino feliz: copia por Core", async () => {
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect(mocks.commitBudgetOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ operation: "copy_previous" })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
  });

  it("recurso previo ajeno/no disponible: 404", async () => {
    const { BudgetOperationError } = await import(
      "@/data/repositories/budgets.repository"
    );
    mocks.commitBudgetOperation.mockRejectedValue(
      new BudgetOperationError("BUDGET_NOT_FOUND", "No hay periodo anterior.")
    );
    expect((await POST(request())).status).toBe(404);
  });

  it("validación: periodo inválido devuelve 400", async () => {
    expect((await POST(request({ period_kind: "anual" }))).status).toBe(400);
  });

  it("idempotencia: replay devuelve 200", async () => {
    mocks.commitBudgetOperation.mockResolvedValue({
      budgets: [{ id: "b1" }],
      budget: null,
      idempotent: true,
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/v1/budgets/copy-previous", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "budget-copy-1",
    },
    body: JSON.stringify({ period_kind: "mensual", ...overrides }),
  });
}
