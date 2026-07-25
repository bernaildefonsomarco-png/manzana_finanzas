import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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
  mocks.getApiAuth.mockReset();
  mocks.getRecurringRuleById.mockReset();
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

function routeContext() {
  return {
    params: Promise.resolve({
      id: "11111111-1111-4111-8111-111111111111",
    }),
  };
}
