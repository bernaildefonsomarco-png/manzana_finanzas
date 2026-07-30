import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getRecurringRuleById: vi.fn(),
  updateRecurringRule: vi.fn(),
  createServiceClient: vi.fn(() => ({})),
  getAccountById: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/repositories/recurring.repository", () => ({
  getRecurringRuleById: mocks.getRecurringRuleById,
  updateRecurringRule: mocks.updateRecurringRule,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
}));

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.createServiceClient.mockReturnValue({});
  mocks.getApiAuth.mockResolvedValue({
    client: {},
    userId: "22222222-2222-4222-8222-222222222222",
  });
  mocks.getRecurringRuleById.mockResolvedValue(ruleFixture());
  mocks.updateRecurringRule.mockResolvedValue(ruleFixture());
});

describe("recurring detail route", () => {
  it("rechaza detalle sin sesion", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/recurring/11111111-1111-4111-8111-111111111111"),
      routeContext()
    );

    expect(response.status).toBe(401);
    expect(mocks.getRecurringRuleById).not.toHaveBeenCalled();
  });

  it("devuelve la regla recurrente del usuario autenticado", async () => {
    const client = {};
    mocks.getApiAuth.mockResolvedValue({
      client,
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getRecurringRuleById.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      name: "Internet",
      occurrences: [],
    });

    const response = await GET(
      new Request("http://localhost/api/v1/recurring/11111111-1111-4111-8111-111111111111"),
      routeContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.data.recurring_rule.name).toBe("Internet");
    expect(mocks.getRecurringRuleById).toHaveBeenCalledWith(
      client,
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111"
    );
  });

  it("responde 404 cuando la regla no existe para el usuario", async () => {
    mocks.getApiAuth.mockResolvedValue({
      client: {},
      userId: "22222222-2222-4222-8222-222222222222",
    });
    mocks.getRecurringRuleById.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/v1/recurring/11111111-1111-4111-8111-111111111111"),
      routeContext()
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.ok).toBe(false);
    expect(payload.error.code).toBe("NOT_FOUND");
  });
});

describe("PATCH /api/v1/recurring/[id]", () => {
  it("camino feliz: una regla variable puede quedar sin estimación", async () => {
    const response = await PATCH(
      patchRequest({
        amount_variability: "variable",
        expected_amount: null,
      }),
      routeContext()
    );

    expect(response.status).toBe(200);
    expect(mocks.updateRecurringRule).toHaveBeenCalledWith(
      expect.anything(),
      "22222222-2222-4222-8222-222222222222",
      "11111111-1111-4111-8111-111111111111",
      expect.objectContaining({
        amountVariability: "variable",
        expectedAmount: null,
      })
    );
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ name: "Internet hogar" }),
      routeContext()
    );

    expect(response.status).toBe(401);
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("regla de otro usuario se oculta como 404, nunca 403", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(null);

    const response = await PATCH(
      patchRequest({ name: "Internet hogar" }),
      routeContext()
    );

    expect(response.status).toBe(404);
  });

  it("validación: no permite fixed sin monto", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(
      ruleFixture({
        amount_variability: "variable",
        expected_amount: null,
      })
    );

    const response = await PATCH(
      patchRequest({ amount_variability: "fixed" }),
      routeContext()
    );

    expect(response.status).toBe(400);
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("idempotencia natural: repetir el mismo PATCH conserva el resultado", async () => {
    const first = await PATCH(
      patchRequest({ name: "Internet hogar" }),
      routeContext()
    );
    const replay = await PATCH(
      patchRequest({ name: "Internet hogar" }),
      routeContext()
    );

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(mocks.updateRecurringRule).toHaveBeenCalledTimes(2);
  });
});

function routeContext() {
  return {
    params: Promise.resolve({
      id: "11111111-1111-4111-8111-111111111111",
    }),
  };
}

function patchRequest(body: unknown) {
  return new Request(
    "http://localhost/api/v1/recurring/11111111-1111-4111-8111-111111111111",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

function ruleFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "22222222-2222-4222-8222-222222222222",
    status: "active",
    name: "Internet",
    expected_amount: 89,
    amount_variability: "fixed",
    currency: "PEN",
    metadata: {},
    occurrences: [],
    ...overrides,
  };
}
