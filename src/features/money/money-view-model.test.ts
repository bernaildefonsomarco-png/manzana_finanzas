import { describe, expect, it } from "vitest";
import {
  getAccountStatusLabel,
  getMoneyHeroCopy,
} from "./money-view-model";
import type { AccountMoneySummary } from "./money-types";

describe("money view model", () => {
  it("nombra estados de cuenta segun el riesgo visual", () => {
    expect(getAccountStatusLabel(account({ balance_status: "negative" }))).toBe(
      "Saldo negativo"
    );
    expect(getAccountStatusLabel(account({ balance_status: "overspent" }))).toBe(
      "Libre negativo"
    );
    expect(getAccountStatusLabel(account({ box_count: 2 }))).toBe("2 cajas");
    expect(getAccountStatusLabel(account())).toBe("Sin cajas");
  });

  it("explica dinero libre sin inventar saldos cuando no hay cuentas", () => {
    expect(
      getMoneyHeroCopy({
        hasAccounts: false,
        freeInAccounts: 0,
        separatedInBoxes: 0,
        upcomingUncoveredCommitments: 0,
      })
    ).toContain("sin asumir saldos");
  });
});

function account(
  overrides: Partial<AccountMoneySummary> = {}
): AccountMoneySummary {
  return {
    id: "account-1",
    user_id: "user-1",
    name: "Yape",
    institution: null,
    type: "digital",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 0,
    is_default: false,
    color: null,
    icon: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    boxes_total: 0,
    free_balance: 0,
    box_count: 0,
    balance_status: "ok",
    ...overrides,
  };
}
