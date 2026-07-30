import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as pause } from "./pause/route";
import { POST as resume } from "./resume/route";
import { POST as restore } from "./restore/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BUDGET_ID = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id: BUDGET_ID }) };

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

const cases = [
  ["pause", pause],
  ["resume", resume],
  ["restore", restore],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.commitBudgetOperation.mockResolvedValue({
    budget: { id: BUDGET_ID },
    idempotent: false,
  });
});

describe.each(cases)("POST /budgets/[id]/%s", (operation, handler) => {
  it("camino feliz", async () => {
    expect((await handler(request(operation), context)).status).toBe(200);
    expect(mocks.commitBudgetOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ operation, budgetId: BUDGET_ID })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await handler(request(operation), context)).status).toBe(401);
  });

  it("recurso de otro usuario: 404", async () => {
    const { BudgetOperationError } = await import(
      "@/data/repositories/budgets.repository"
    );
    mocks.commitBudgetOperation.mockRejectedValue(
      new BudgetOperationError(
        "BUDGET_NOT_FOUND",
        "No encontre ese presupuesto."
      )
    );
    expect((await handler(request(operation), context)).status).toBe(404);
  });

  it("validación: id inválido devuelve 400", async () => {
    expect(
      (
        await handler(request(operation), {
          params: Promise.resolve({ id: "invalido" }),
        })
      ).status
    ).toBe(400);
  });

  it("idempotencia: replay se declara", async () => {
    mocks.commitBudgetOperation.mockResolvedValue({
      budget: { id: BUDGET_ID },
      idempotent: true,
    });
    const response = await handler(request(operation), context);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

function request(operation: string) {
  return new Request(
    `http://localhost/api/v1/budgets/${BUDGET_ID}/${operation}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `budget-${operation}-1`,
      },
      body: "{}",
    }
  );
}
