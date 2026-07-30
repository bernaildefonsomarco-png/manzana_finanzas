import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BUDGET_ID = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id: BUDGET_ID }) };

const mocks = vi.hoisted(() => ({
  commitBudgetOperation: vi.fn(),
  getApiAuth: vi.fn(),
  getBudgetDetail: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  commitBudgetOperation: mocks.commitBudgetOperation,
  getBudgetDetail: mocks.getBudgetDetail,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.getBudgetDetail.mockResolvedValue({ id: BUDGET_ID, amount: 400 });
  mocks.commitBudgetOperation.mockResolvedValue({
    budget: { id: BUDGET_ID, amount: 450 },
    idempotent: false,
  });
});

describe("GET /api/v1/budgets/[id]", () => {
  it("camino feliz", async () => {
    const response = await GET(readRequest(), context);
    expect(response.status).toBe(200);
    expect((await response.json()).data.budget.id).toBe(BUDGET_ID);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(readRequest(), context)).status).toBe(401);
  });

  it("recurso de otro usuario: 404, nunca 403", async () => {
    mocks.getBudgetDetail.mockResolvedValue(null);
    expect((await GET(readRequest(), context)).status).toBe(404);
  });

  it("validación: id inválido devuelve 400", async () => {
    expect(
      (
        await GET(readRequest(), {
          params: Promise.resolve({ id: "ajeno" }),
        })
      ).status
    ).toBe(400);
  });

  it("idempotencia de lectura: repetir no escribe", async () => {
    await GET(readRequest(), context);
    await GET(readRequest(), context);
    expect(mocks.getBudgetDetail).toHaveBeenCalledTimes(2);
    expect(mocks.commitBudgetOperation).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/budgets/[id]", () => {
  it("camino feliz", async () => {
    const response = await PATCH(writeRequest("PATCH", { amount: 450 }), context);
    expect(response.status).toBe(200);
    expect(mocks.commitBudgetOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({
        operation: "update",
        budgetId: BUDGET_ID,
      })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect(
      (await PATCH(writeRequest("PATCH", { amount: 450 }), context)).status
    ).toBe(401);
  });

  it("recurso de otro usuario: 404", async () => {
    await rejectNotFound();
    expect(
      (await PATCH(writeRequest("PATCH", { amount: 450 }), context)).status
    ).toBe(404);
  });

  it("validación: cambio vacío devuelve 400", async () => {
    expect((await PATCH(writeRequest("PATCH", {}), context)).status).toBe(400);
  });

  it("idempotencia: replay se declara", async () => {
    mocks.commitBudgetOperation.mockResolvedValue({
      budget: { id: BUDGET_ID },
      idempotent: true,
    });
    const response = await PATCH(
      writeRequest("PATCH", { amount: 450 }),
      context
    );
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

describe("DELETE /api/v1/budgets/[id]", () => {
  it("camino feliz: archiva", async () => {
    const response = await DELETE(writeRequest("DELETE"), context);
    expect(response.status).toBe(200);
    expect(mocks.commitBudgetOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ operation: "archive" })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await DELETE(writeRequest("DELETE"), context)).status).toBe(401);
  });

  it("recurso de otro usuario: 404", async () => {
    await rejectNotFound();
    expect((await DELETE(writeRequest("DELETE"), context)).status).toBe(404);
  });

  it("validación: id inválido devuelve 400", async () => {
    expect(
      (
        await DELETE(writeRequest("DELETE"), {
          params: Promise.resolve({ id: "invalido" }),
        })
      ).status
    ).toBe(400);
  });

  it("idempotencia: retry devuelve la misma entidad", async () => {
    mocks.commitBudgetOperation.mockResolvedValue({
      budget: { id: BUDGET_ID, status: "archivado" },
      idempotent: true,
    });
    const response = await DELETE(writeRequest("DELETE"), context);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

function readRequest() {
  return new Request(`http://localhost/api/v1/budgets/${BUDGET_ID}`);
}

function writeRequest(method: string, body?: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/budgets/${BUDGET_ID}`, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `budget-${method.toLowerCase()}-1`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function rejectNotFound() {
  const { BudgetOperationError } = await import(
    "@/data/repositories/budgets.repository"
  );
  mocks.commitBudgetOperation.mockRejectedValue(
    new BudgetOperationError(
      "BUDGET_NOT_FOUND",
      "No encontre ese presupuesto."
    )
  );
}
