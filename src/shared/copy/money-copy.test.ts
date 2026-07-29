import { describe, expect, it } from "vitest";
import { getAccountStatusLabel, getMoneyHeroCopy } from "./money-copy";
import type { AccountMoneySummary } from "@/shared/api/money-types";

function account(overrides: Partial<AccountMoneySummary>): AccountMoneySummary {
  return {
    id: "a1",
    user_id: "u1",
    name: "BCP",
    institution: null,
    type: "banco",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 0,
    is_default: false,
    color: null,
    icon: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    metadata: {},
    boxes_total: 0,
    free_balance: 0,
    box_count: 0,
    balance_status: "ok",
    ...overrides,
  };
}

describe("getAccountStatusLabel", () => {
  it("saldo negativo tiene prioridad sobre libre negativo y cajas", () => {
    expect(
      getAccountStatusLabel(account({ balance_status: "negative", box_count: 3 }))
    ).toBe("Saldo negativo");
  });

  it("libre negativo tiene prioridad sobre el conteo de cajas", () => {
    expect(
      getAccountStatusLabel(account({ balance_status: "overspent", box_count: 2 }))
    ).toBe("Libre negativo");
  });

  it("muestra el conteo de cajas cuando el saldo esta bien", () => {
    expect(getAccountStatusLabel(account({ box_count: 2 }))).toBe("2 cajas");
  });

  it("sin cajas cuando el conteo es cero", () => {
    expect(getAccountStatusLabel(account({ box_count: 0 }))).toBe("Sin cajas");
  });
});

describe("getMoneyHeroCopy", () => {
  it("sin cuentas: explica que hace falta una cuenta", () => {
    expect(
      getMoneyHeroCopy({
        hasAccounts: false,
        separatedInBoxes: 0,
        upcomingUncoveredCommitments: 0,
      })
    ).toContain("sin asumir saldos");
  });

  it("compromisos sin cubrir tienen prioridad sobre las cajas", () => {
    expect(
      getMoneyHeroCopy({
        hasAccounts: true,
        separatedInBoxes: 500,
        upcomingUncoveredCommitments: 50,
      })
    ).toContain("compromisos proximos");
  });

  it("con cajas pero sin compromisos, explica el descuento de cajas", () => {
    expect(
      getMoneyHeroCopy({
        hasAccounts: true,
        separatedInBoxes: 500,
        upcomingUncoveredCommitments: 0,
      })
    ).toContain("separaste en cajas");
  });

  it("sin cajas ni compromisos: coincide con el saldo registrado (09 §9)", () => {
    expect(
      getMoneyHeroCopy({
        hasAccounts: true,
        separatedInBoxes: 0,
        upcomingUncoveredCommitments: 0,
      })
    ).toContain("coincide con tu saldo registrado");
  });
});
