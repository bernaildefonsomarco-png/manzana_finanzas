import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Movement } from "@/shared/types/domain";

const mocks = vi.hoisted(() => ({ listMovementsFiltered: vi.fn() }));
vi.mock("@/features/movements/movements-api", () => mocks);

const { loadAccountBalanceProvenance, loadBoxBalanceProvenance } = await import("./balance-provenance");

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: "m1",
    user_id: "u1",
    type: "gasto",
    status: "confirmed",
    amount: 32,
    currency: "PEN",
    occurred_at: "2026-07-26T15:00:00Z",
    description: null,
    merchant: "Rappi",
    category_id: "alimentacion",
    subcategory_id: null,
    source: "dashboard_manual",
    source_ref: null,
    idempotency_key: "k1",
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
    ...overrides,
  } as Movement;
}

beforeEach(() => {
  mocks.listMovementsFiltered.mockReset();
});

describe("loadAccountBalanceProvenance — saldo corriente, no una suma completa", () => {
  it("pide los movimientos de esa cuenta y los declara como 'los últimos N', no el total", async () => {
    mocks.listMovementsFiltered.mockResolvedValue([movement({ id: "m1" })]);
    const data = await loadAccountBalanceProvenance({
      accountId: "acc-1",
      currentBalance: 500,
      initialBalance: 100,
      currency: "PEN",
    });
    expect(mocks.listMovementsFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: "acc-1" }),
    );
    expect(data.title).toBe("De dónde sale este saldo de S/500.00");
    expect(data.rowsTitle).toBe("Los 1 movimientos");
    expect(data.rows).toHaveLength(1);
  });
});

describe("loadBoxBalanceProvenance", () => {
  it("filtra por box_id, no por account_id", async () => {
    mocks.listMovementsFiltered.mockResolvedValue([]);
    await loadBoxBalanceProvenance({ boxId: "box-1", currentBalance: 200, currency: "PEN" });
    expect(mocks.listMovementsFiltered).toHaveBeenCalledWith(
      expect.objectContaining({ box_id: "box-1" }),
    );
  });
});
