import { beforeEach, describe, expect, it, vi } from "vitest";
import { getProjectionSnapshot } from "./projections.repository";

const mocks = vi.hoisted(() => ({
  getActiveAccounts: vi.fn(),
  getActiveBoxes: vi.fn(),
  listDebtInstallmentCommitments: vi.fn(),
  listUpcomingCommitments: vi.fn(),
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getActiveAccounts: mocks.getActiveAccounts,
  getActiveBoxes: mocks.getActiveBoxes,
}));
vi.mock("@/data/repositories/debts.repository", () => ({
  listDebtInstallmentCommitments: mocks.listDebtInstallmentCommitments,
}));
vi.mock("@/data/repositories/recurring.repository", () => ({
  listUpcomingCommitments: mocks.listUpcomingCommitments,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getActiveAccounts.mockResolvedValue([
    {
      id: "a1",
      currency: "PEN",
      current_balance: 649,
    },
  ]);
  mocks.getActiveBoxes.mockResolvedValue([]);
  mocks.listUpcomingCommitments.mockResolvedValue([
    {
      id: "rec_1",
      amount: 89,
      currency: "PEN",
      due_at: "2026-07-28",
      linked_box_id: null,
      kind: "recurring",
    },
  ]);
  mocks.listDebtInstallmentCommitments.mockResolvedValue([]);
});

describe("getProjectionSnapshot", () => {
  it("AC-PROY-02/02b/03: 560 - 62×5 = 250, sin segunda resta de compromisos y sin N+1", async () => {
    const from = vi.fn(() => thenableQuery(dailyMovements()));
    const result = await getProjectionSnapshot(
      { from } as never,
      "user-1",
      new Date("2026-07-26T12:00:00-05:00")
    );

    expect(result.projection.free_money_cents).toBe(56_000);
    expect(result.projection.uncovered_commitments_cents).toBe(8_900);
    expect(result.projection.daily_pace_cents).toBe(6_200);
    expect(result.projection.days_remaining).toBe(5);
    expect(result.projection.projection_cents).toBe(25_000);
    expect(result.projection.projection_cents).not.toBe(16_100);
    expect(from).toHaveBeenCalledTimes(1);
    expect(mocks.getActiveAccounts).toHaveBeenCalledTimes(1);
    expect(mocks.getActiveBoxes).toHaveBeenCalledTimes(1);
    expect(mocks.listUpcomingCommitments).toHaveBeenCalledTimes(1);
    expect(mocks.listDebtInstallmentCommitments).toHaveBeenCalledTimes(1);
  });
});

function dailyMovements() {
  return Array.from({ length: 14 }, (_, index) => {
    const day = 13 + index;
    return {
      id: `m${index + 1}`,
      user_id: "user-1",
      type: "gasto",
      status: "confirmed",
      amount: 62,
      currency: "PEN",
      occurred_at: `2026-07-${String(day).padStart(2, "0")}T17:00:00.000Z`,
      description: null,
      merchant: null,
      category_id: "alimentacion",
      subcategory_id: null,
      source: "dashboard_manual",
      source_ref: null,
      idempotency_key: `k${index}`,
      confidence: null,
      requires_review: false,
      account_origin_id: null,
      account_destination_id: null,
      box_origin_id: null,
      box_destination_id: null,
      debt_id: null,
      recurring_rule_id: null,
      recurring_occurrence_id: null,
      related_person_id: null,
      affects_total_balance: true,
      affects_account_balance: true,
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
      deleted_at: null,
      metadata: {},
    };
  });
}

function thenableQuery(data: unknown[]) {
  const result = { data, error: null };
  const query: Record<string, unknown> & PromiseLike<typeof result> = {
    then(onfulfilled, onrejected) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };
  for (const method of ["select", "eq", "in", "gte", "lt", "order"]) {
    query[method] = vi.fn(() => query);
  }
  return query;
}
