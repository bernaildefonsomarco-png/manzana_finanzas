import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET as getHealth } from "./health/route";
import { GET as getBreakdown } from "./period/breakdown/route";
import { GET as getPeriod } from "./period/route";

const USER_ID = "11111111-1111-4111-8111-111111111111";
const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  getProjectionSnapshot: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({ getApiAuth: mocks.getApiAuth }));
vi.mock("@/data/repositories/projections.repository", () => ({
  getProjectionSnapshot: mocks.getProjectionSnapshot,
}));

const routes = [
  ["period", getPeriod],
  ["health", getHealth],
  ["period/breakdown", getBreakdown],
] as const;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getApiAuth.mockResolvedValue({ client: {}, userId: USER_ID });
  mocks.getProjectionSnapshot.mockResolvedValue(snapshot());
});

describe.each(routes)("GET /api/v1/projections/%s", (path, handler) => {
  it("camino feliz", async () => {
    expect((await handler(request(path))).status).toBe(200);
  });

  it("sin sesión: 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    expect((await handler(request(path))).status).toBe(401);
  });

  it("aislamiento: solo carga el estado del usuario autenticado", async () => {
    await handler(request(path));
    expect(mocks.getProjectionSnapshot).toHaveBeenCalledWith(
      expect.anything(),
      USER_ID
    );
  });

  it("validación: filtro desconocido devuelve 400", async () => {
    expect(
      (
        await handler(
          new Request(
            `http://localhost/api/v1/projections/${path}?horizon=90`
          )
        )
      ).status
    ).toBe(400);
  });

  it("idempotencia de lectura: repetir solo recalcula, nunca escribe", async () => {
    await handler(request(path));
    await handler(request(path));
    expect(mocks.getProjectionSnapshot).toHaveBeenCalledTimes(2);
  });
});

function request(path: string) {
  return new Request(`http://localhost/api/v1/projections/${path}`);
}

function snapshot() {
  const projection = {
    currency: "PEN" as const,
    period_start: "2026-07-01",
    period_end: "2026-07-31",
    as_of: "2026-07-26",
    free_money_cents: 56_000,
    uncovered_commitments_cents: 8_900,
    observed_days: 14,
    sample_start: "2026-07-13",
    sample_end: "2026-07-26",
    daily_spend_cents: Array(14).fill(6_200),
    daily_pace_cents: 6_200,
    q1_cents: 6_200,
    q3_cents: 6_200,
    iqr_cents: 0,
    days_remaining: 5,
    sufficient_data: true,
    insufficiency_reason: null,
    projection_cents: 25_000,
    range: null,
    assumptions: [
      {
        kind: "commitments_already_discounted" as const,
        amount_cents: 8_900,
        refs: ["rec_1"],
      },
      {
        kind: "daily_pace" as const,
        amount_cents: 6_200,
        basis: "median_14_lima_calendar_days" as const,
        refs: ["mov_1"],
      },
      { kind: "days_remaining" as const, value: 5, refs: [] as [] },
      {
        kind: "future_income" as const,
        amount_cents: 0 as const,
        basis: "not_available_v1" as const,
        refs: [] as [],
      },
    ],
  };
  return {
    projection,
    has_pen_accounts: true,
    breakdown: {
      currency: "PEN" as const,
      lines: [
        {
          kind: "free_money" as const,
          amount_cents: 56_000,
          refs: [],
        },
      ],
    },
    situation: {
      currency: "PEN" as const,
      period_start: "2026-07-01",
      period_end: "2026-07-31",
      as_of: "2026-07-26",
      coverage: {
        availability: "available" as const,
        uncovered_cents: 8_900,
        covered: false,
        refs: ["rec_1"],
      },
      spending_income: {
        availability: "available" as const,
        spending_cents: 78_000,
        income_cents: 100_000,
        ratio_basis_points: 7_800,
        refs: ["mov_1"],
      },
      reserve: {
        availability: "available" as const,
        total_cents: 50_000,
        refs: ["box_1"],
      },
      debts: {
        availability: "available" as const,
        overdue_count: 0,
        due_this_month_count: 3,
        refs: ["inst_1"],
      },
      summary_facts: ["Tus datos del mes estan disponibles."],
    },
  };
}
