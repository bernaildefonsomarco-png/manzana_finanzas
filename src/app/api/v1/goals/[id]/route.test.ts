import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET, PATCH } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GOAL_ID = "22222222-2222-4222-8222-222222222222";
const context = { params: Promise.resolve({ id: GOAL_ID }) };
const mocks = vi.hoisted(() => ({
  commitGoalOperation: vi.fn(),
  getApiAuth: vi.fn(),
  getGoalDetail: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  commitGoalOperation: mocks.commitGoalOperation,
  getGoalDetail: mocks.getGoalDetail,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.getGoalDetail.mockResolvedValue({ id: GOAL_ID, name: "Viaje" });
  mocks.commitGoalOperation.mockResolvedValue({
    goal: { id: GOAL_ID, name: "Viaje" },
    idempotent: false,
  });
});

describe("GET /api/v1/goals/[id]", () => {
  it("camino feliz", async () => {
    expect((await GET(readRequest(), context)).status).toBe(200);
  });
  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await GET(readRequest(), context)).status).toBe(401);
  });
  it("recurso ajeno: 404", async () => {
    mocks.getGoalDetail.mockResolvedValue(null);
    expect((await GET(readRequest(), context)).status).toBe(404);
  });
  it("validación: id inválido", async () => {
    expect(
      (
        await GET(readRequest(), {
          params: Promise.resolve({ id: "mal" }),
        })
      ).status
    ).toBe(400);
  });
  it("idempotencia de lectura", async () => {
    await GET(readRequest(), context);
    await GET(readRequest(), context);
    expect(mocks.getGoalDetail).toHaveBeenCalledTimes(2);
    expect(mocks.commitGoalOperation).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/v1/goals/[id]", () => {
  it("camino feliz", async () => {
    expect(
      (await PATCH(writeRequest("PATCH", { name: "Viaje 2027" }), context))
        .status
    ).toBe(200);
  });
  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect(
      (await PATCH(writeRequest("PATCH", { name: "Viaje 2027" }), context))
        .status
    ).toBe(401);
  });
  it("recurso ajeno: 404", async () => {
    await rejectNotFound();
    expect(
      (await PATCH(writeRequest("PATCH", { name: "Viaje 2027" }), context))
        .status
    ).toBe(404);
  });
  it("validación: body vacío", async () => {
    expect((await PATCH(writeRequest("PATCH", {}), context)).status).toBe(400);
  });
  it("idempotencia: replay", async () => {
    mocks.commitGoalOperation.mockResolvedValue({
      goal: { id: GOAL_ID },
      idempotent: true,
    });
    const response = await PATCH(
      writeRequest("PATCH", { name: "Viaje 2027" }),
      context
    );
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

describe("DELETE /api/v1/goals/[id]", () => {
  it("camino feliz", async () => {
    expect((await DELETE(writeRequest("DELETE"), context)).status).toBe(200);
    expect(mocks.commitGoalOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ operation: "archive" })
    );
  });
  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await DELETE(writeRequest("DELETE"), context)).status).toBe(401);
  });
  it("recurso ajeno: 404", async () => {
    await rejectNotFound();
    expect((await DELETE(writeRequest("DELETE"), context)).status).toBe(404);
  });
  it("validación: id inválido", async () => {
    expect(
      (
        await DELETE(writeRequest("DELETE"), {
          params: Promise.resolve({ id: "mal" }),
        })
      ).status
    ).toBe(400);
  });
  it("idempotencia: replay", async () => {
    mocks.commitGoalOperation.mockResolvedValue({
      goal: { id: GOAL_ID },
      idempotent: true,
    });
    const response = await DELETE(writeRequest("DELETE"), context);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
});

function readRequest() {
  return new Request(`http://localhost/api/v1/goals/${GOAL_ID}`);
}
function writeRequest(method: string, body?: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/goals/${GOAL_ID}`, {
    method,
    headers: {
      "content-type": "application/json",
      "idempotency-key": `goal-${method.toLowerCase()}-1`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function rejectNotFound() {
  const { BudgetOperationError } = await import(
    "@/data/repositories/budgets.repository"
  );
  mocks.commitGoalOperation.mockRejectedValue(
    new BudgetOperationError("GOAL_NOT_FOUND", "No encontre esa meta.")
  );
}
