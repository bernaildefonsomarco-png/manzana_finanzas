import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  simulateProjectionExpense: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/projections.repository", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/data/repositories/projections.repository")
  >()),
  simulateProjectionExpense: mocks.simulateProjectionExpense,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.simulateProjectionExpense.mockResolvedValue({
    has_pen_accounts: true,
    budget_effect: null,
    simulation: {
      currency: "PEN",
      parts: [
        {
          kind: "immediate_effect",
          free_money_before_cents: 56_000,
          simulated_amount_cents: 30_000,
          free_money_after_cents: 26_000,
        },
        {
          kind: "already_counted",
          uncovered_commitments_cents: 8_900,
          refs: ["rec_1"],
        },
        {
          kind: "projected_close",
          available: true,
          projection_cents: -5_000,
          range: null,
          assumptions: [],
        },
      ],
    },
  });
});

describe("POST /api/v1/simulate", () => {
  it("camino feliz: devuelve tres partes y no escribe", async () => {
    const response = await POST(request());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.data.simulation.parts).toHaveLength(3);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
  });

  it("aislamiento: calcula solo con el estado del usuario autenticado", async () => {
    await POST(request());
    expect(mocks.simulateProjectionExpense).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID,
      expect.objectContaining({ amount: 300 })
    );
  });

  it("validación: monto cero devuelve 400", async () => {
    expect((await POST(request({ amount: 0 }))).status).toBe(400);
    expect(mocks.simulateProjectionExpense).not.toHaveBeenCalled();
  });

  it("idempotencia de solo lectura: repetir no crea estado", async () => {
    await POST(request());
    await POST(request());
    expect(mocks.simulateProjectionExpense).toHaveBeenCalledTimes(2);
  });
});

function request(overrides: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/v1/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 300, ...overrides }),
  });
}
