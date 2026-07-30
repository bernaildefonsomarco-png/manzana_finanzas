import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as accept } from "./accept/route";
import { POST as dismiss } from "./dismiss/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const SUGGESTION_ID = "bs_alimentacion_mensual_2026-04-01_2026-06-30";
const context = { params: Promise.resolve({ id: SUGGESTION_ID }) };
const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  resolveBudgetSuggestion: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/budgets.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/budgets.repository")
  >()),
  resolveBudgetSuggestion: mocks.resolveBudgetSuggestion,
}));

const cases = [
  ["accepted", "accept", accept],
  ["dismissed", "dismiss", dismiss],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.resolveBudgetSuggestion.mockResolvedValue({
    decision: { suggestion_key: SUGGESTION_ID },
    budget: { id: "b1" },
    idempotent: false,
  });
});

describe.each(cases)(
  "POST suggestion %s",
  (resolution, routeSlug, handler) => {
  it("camino feliz", async () => {
    const response = await handler(request(resolution, routeSlug), context);
    expect([200, 201]).toContain(response.status);
    expect(mocks.resolveBudgetSuggestion).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ resolution, suggestionKey: SUGGESTION_ID })
    );
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await handler(request(resolution, routeSlug), context)).status).toBe(
      401,
    );
  });

  it("recurso de otro usuario: 404", async () => {
    const { BudgetOperationError } = await import(
      "@/data/repositories/budgets.repository"
    );
    mocks.resolveBudgetSuggestion.mockRejectedValue(
      new BudgetOperationError("BUDGET_NOT_FOUND", "Sugerencia no encontrada.")
    );
    expect((await handler(request(resolution, routeSlug), context)).status).toBe(
      404,
    );
  });

  it("validación: identificador vacío devuelve 400", async () => {
    expect(
      (
        await handler(request(resolution, routeSlug), {
          params: Promise.resolve({ id: "" }),
        })
      ).status
    ).toBe(400);
  });

  it("idempotencia: replay se declara", async () => {
    mocks.resolveBudgetSuggestion.mockResolvedValue({
      decision: { suggestion_key: SUGGESTION_ID },
      budget: { id: "b1" },
      idempotent: true,
    });
    const response = await handler(request(resolution, routeSlug), context);
    expect((await response.json()).meta.idempotent_replay).toBe(true);
  });
  },
);

function request(
  resolution: "accepted" | "dismissed",
  routeSlug: "accept" | "dismiss",
) {
  return new Request(
    `http://localhost/api/v1/budgets/suggestions/${SUGGESTION_ID}/${routeSlug}`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "idempotency-key": `suggestion-${resolution}-1`,
      },
      body: "{}",
    }
  );
}
