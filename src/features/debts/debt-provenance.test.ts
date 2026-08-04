import { describe, expect, it } from "vitest";
import type { DebtDetailWithPayments, DebtWithPerson } from "./debts-types";
import { buildDebtProvenance, buildDebtsSummaryProvenance } from "./debt-provenance";

function debt(overrides: Partial<DebtWithPerson> = {}): DebtWithPerson {
  return {
    id: "debt-1",
    user_id: "user-1",
    direction: "i_owe",
    kind: "installment_purchase",
    status: "active",
    related_person_id: null,
    related_person: null,
    linked_box: null,
    name: "Laptop",
    principal_amount: 1200,
    current_balance: 1100,
    currency: "PEN",
    opened_at: "2026-06-01",
    due_date: "2026-11-01",
    next_payment_date: "2026-08-01",
    installment_count: 4,
    installment_amount: 300,
    interest_notes: null,
    source: "dashboard_manual",
    confidence: 1,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    ...overrides,
  } as DebtWithPerson;
}

function detail(overrides: Partial<DebtDetailWithPayments> = {}): DebtDetailWithPayments {
  return {
    ...debt(),
    payments: [],
    installments: [],
    ...overrides,
  } as DebtDetailWithPayments;
}

describe("buildDebtProvenance — el saldo pendiente es principal menos lo pagado", () => {
  it("los pagos activos son las filas; uno revertido va a qué no conté", () => {
    const d = detail({
      principal_amount: 1200,
      current_balance: 1100,
      payments: [
        {
          id: "p1",
          user_id: "u1",
          debt_id: "debt-1",
          movement_id: "m1",
          amount: 100,
          currency: "PEN",
          paid_at: "2026-07-01T00:00:00Z",
          source: "dashboard_manual",
          metadata: {},
          created_at: "2026-07-01T00:00:00Z",
          movement: null,
          allocations: [],
        },
        {
          id: "p2",
          user_id: "u1",
          debt_id: "debt-1",
          movement_id: null,
          amount: 50,
          currency: "PEN",
          paid_at: "2026-07-05T00:00:00Z",
          reversed_at: "2026-07-06T00:00:00Z",
          reversal_reason: "duplicado",
          source: "dashboard_manual",
          metadata: {},
          created_at: "2026-07-05T00:00:00Z",
          movement: null,
          allocations: [],
        },
      ],
    });

    const data = buildDebtProvenance(d);

    expect(data.title).toBe("De dónde sale este saldo pendiente de S/1,100.00");
    expect(data.rows).toEqual([
      expect.objectContaining({ id: "p1", amount: 100, href: "/movimientos/m1" }),
    ]);
    expect(data.notCounted).toEqual([{ text: "1 pago revertido, no afectan el saldo" }]);
  });
});

describe("buildDebtsSummaryProvenance — filtra igual que summarizeDebts", () => {
  it("solo deudas activas, PEN, en esa dirección", () => {
    const debts = [
      debt({ id: "d1", direction: "i_owe", status: "active", currency: "PEN", current_balance: 500 }),
      debt({ id: "d2", direction: "i_owe", status: "paid", currency: "PEN", current_balance: 0 }),
      debt({ id: "d3", direction: "they_owe_me", status: "active", currency: "PEN", current_balance: 300 }),
      debt({ id: "d4", direction: "i_owe", status: "active", currency: "USD", current_balance: 80 }),
    ];

    const data = buildDebtsSummaryProvenance(debts, "i_owe");

    expect(data.rows.map((r) => r.id)).toEqual(["d1"]);
    expect(data.title).toBe("De dónde sale este S/500.00");
  });
});
