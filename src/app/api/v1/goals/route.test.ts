import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const BOX_ID = "22222222-2222-4222-8222-222222222222";
const mocks = vi.hoisted(() => ({
  commitGoalOperation: vi.fn(),
  getApiAuth: vi.fn(),
  listGoals: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  commitGoalOperation: mocks.commitGoalOperation,
  listGoals: mocks.listGoals,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.listGoals.mockResolvedValue([]);
  mocks.commitGoalOperation.mockResolvedValue({
    goal: { id: "33333333-3333-4333-8333-333333333333", name: "Viaje" },
    idempotent: false,
  });
});

describe("GET /api/v1/goals", () => {
  it("camino feliz", async () => {
    mocks.listGoals.mockResolvedValue([
      { id: "g1", created_at: "2026-07-01T00:00:00Z" },
    ]);
    const response = await GET(new Request("http://localhost/api/v1/goals"));
    expect(response.status).toBe(200);
    expect((await response.json()).data.goals).toHaveLength(1);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect(
      (await GET(new Request("http://localhost/api/v1/goals"))).status
    ).toBe(401);
  });

  it("aislamiento: consulta por el usuario autenticado", async () => {
    await GET(new Request("http://localhost/api/v1/goals"));
    expect(mocks.listGoals).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.any(Object)
    );
  });

  it("validación: filtro desconocido devuelve 400", async () => {
    expect(
      (
        await GET(new Request("http://localhost/api/v1/goals?owner=other"))
      ).status
    ).toBe(400);
  });

  it("idempotencia de lectura: repetir no escribe", async () => {
    const request = () => new Request("http://localhost/api/v1/goals");
    await GET(request());
    await GET(request());
    expect(mocks.listGoals).toHaveBeenCalledTimes(2);
    expect(mocks.commitGoalOperation).not.toHaveBeenCalled();
  });
});

describe("POST /api/v1/goals", () => {
  it("camino feliz", async () => {
    const response = await POST(createRequest());
    expect(response.status).toBe(201);
    expect(mocks.commitGoalOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({
        operation: "create",
        payload: expect.objectContaining({ currency: "PEN" }),
      })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(createRequest())).status).toBe(401);
  });

  it("caja de otro usuario: 404, nunca 403", async () => {
    const { BudgetOperationError } = await import(
      "@/data/repositories/budgets.repository"
    );
    mocks.commitGoalOperation.mockRejectedValue(
      new BudgetOperationError("GOAL_NOT_FOUND", "No encontre esa caja.")
    );
    expect((await POST(createRequest())).status).toBe(404);
  });

  it("validación: objetivo cero devuelve 400", async () => {
    expect(
      (await POST(createRequest({ target_amount: 0 }))).status
    ).toBe(400);
  });

  it("idempotencia: replay devuelve 200", async () => {
    mocks.commitGoalOperation.mockResolvedValue({
      goal: { id: "g1", name: "Viaje" },
      idempotent: true,
    });
    const response = await POST(createRequest());
    expect(response.status).toBe(200);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

function createRequest(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/v1/goals", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": "goal-create-1",
    },
    body: JSON.stringify({
      name: "Viaje",
      target_amount: 1200,
      target_date: "2027-02-01",
      box_id: BOX_ID,
      ...overrides,
    }),
  });
}
