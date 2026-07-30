import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as linkBox } from "./link-box/route";
import { POST as pause } from "./pause/route";
import { POST as restore } from "./restore/route";
import { POST as resume } from "./resume/route";
import { POST as unlinkBox } from "./unlink-box/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const GOAL_ID = "22222222-2222-4222-8222-222222222222";
const BOX_ID = "33333333-3333-4333-8333-333333333333";
const context = { params: Promise.resolve({ id: GOAL_ID }) };
const mocks = vi.hoisted(() => ({
  commitGoalOperation: vi.fn(),
  getApiAuth: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  commitGoalOperation: mocks.commitGoalOperation,
}));

const cases = [
  ["pause", "pause", pause],
  ["resume", "resume", resume],
  ["restore", "restore", restore],
  ["link_box", "link-box", linkBox],
  ["unlink_box", "unlink-box", unlinkBox],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.commitGoalOperation.mockResolvedValue({
    goal: { id: GOAL_ID },
    idempotent: false,
  });
});

describe.each(cases)(
  "POST goal action %s",
  (operation, routeSlug, handler) => {
  it("camino feliz", async () => {
    expect((await handler(request(operation, routeSlug), context)).status).toBe(
      200,
    );
    expect(mocks.commitGoalOperation).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ operation, goalId: GOAL_ID })
    );
  });
  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await handler(request(operation, routeSlug), context)).status).toBe(
      401,
    );
  });
  it("recurso ajeno: 404", async () => {
    const { BudgetOperationError } = await import(
      "@/data/repositories/budgets.repository"
    );
    mocks.commitGoalOperation.mockRejectedValue(
      new BudgetOperationError("GOAL_NOT_FOUND", "No encontre esa meta.")
    );
    expect((await handler(request(operation, routeSlug), context)).status).toBe(
      404,
    );
  });
  it("validación: id inválido o caja inválida", async () => {
    const response =
      operation === "link_box"
        ? await handler(
            request(operation, routeSlug, { box_id: "mal" }),
            context,
          )
        : await handler(request(operation, routeSlug), {
            params: Promise.resolve({ id: "mal" }),
          });
    expect(response.status).toBe(400);
  });
  it("idempotencia: replay", async () => {
    mocks.commitGoalOperation.mockResolvedValue({
      goal: { id: GOAL_ID },
      idempotent: true,
    });
    const response = await handler(request(operation, routeSlug), context);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
  },
);

function request(
  operation: (typeof cases)[number][0],
  routeSlug: (typeof cases)[number][1],
  body?: Record<string, unknown>
) {
  return new Request(`http://localhost/api/v1/goals/${GOAL_ID}/${routeSlug}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "idempotency-key": `goal-${operation}-1`,
    },
    body: JSON.stringify(
      body ?? (operation === "link_box" ? { box_id: BOX_ID } : {})
    ),
  });
}
