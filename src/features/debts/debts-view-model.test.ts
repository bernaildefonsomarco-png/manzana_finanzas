import { describe, expect, it } from "vitest";
import type {
  DebtDetailWithPayments,
  DebtWithPerson,
} from "./debts-types";
import {
  buildInstallmentSchedulePreview,
  formatDebtMoney,
  resolveDebtInstallmentPaymentTarget,
  splitDebtsByState,
  summarizeDebts,
  toDebtDetailViewModel,
  toDebtViewItem,
} from "./debts-view-model";

describe("debt view model W-11", () => {
  it("presenta saldos brutos por dirección y no calcula un neto primario", () => {
    const summary = summarizeDebts([
      debtFixture({ current_balance: 100 }),
      debtFixture({
        id: "debt-2",
        direction: "they_owe_me",
        current_balance: 40,
      }),
      debtFixture({ id: "debt-3", status: "paid", current_balance: 0 }),
      debtFixture({
        id: "debt-usd",
        currency: "USD",
        current_balance: 25,
      }),
    ]);

    expect(summary.total_i_owe).toBe(100);
    expect(summary.total_they_owe_me).toBe(40);
    expect(summary.total_i_owe_usd).toBe(25);
    expect(summary.total_they_owe_me_usd).toBe(0);
    expect(summary.active_i_owe).toBe(2);
    expect(summary.active_they_owe_me).toBe(1);
    expect(summary.closed_count).toBe(1);
    expect(summary).not.toHaveProperty("net_position");
  });

  it("separa pestañas Debo/Me deben y conserva cerradas aparte", () => {
    const result = splitDebtsByState(
      [
        debtFixture({ next_payment_date: "2026-09-01" }),
        debtFixture({
          id: "urgent",
          next_payment_date: "2026-08-01",
        }),
        debtFixture({ id: "paid", status: "paid", current_balance: 0 }),
        debtFixture({ id: "receivable", direction: "they_owe_me" }),
      ],
      "i_owe"
    );
    expect(result.open.map((item) => item.id)).toEqual([
      "urgent",
      "debt-1",
    ]);
    expect(result.closed.map((item) => item.id)).toEqual(["paid"]);
  });

  it("una condonación no se presenta como pago del saldo perdonado", () => {
    const item = toDebtViewItem(
      debtFixture({
        status: "cancelled",
        principal_amount: 100,
        current_balance: 0,
        metadata: { forgiven_balance: 80 },
      })
    );
    expect(item.status_label).toBe("Condonada");
    expect(item.paid_amount).toBe(20);
    expect(item.progress).toBe(20);
  });

  it("muestra la caja canónica sin asumir que se consumirá", () => {
    const item = toDebtViewItem(
      debtFixture({
        linked_box: {
          id: "box-1",
          user_id: "user-1",
          account_id: "account-1",
          name: "Cuota laptop",
          type: "compromiso",
          current_balance: 60,
          target_amount: null,
          target_date: null,
          linked_debt_id: "debt-1",
          linked_recurring_id: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          deleted_at: null,
        },
      })
    );
    expect(item.linked_box_name).toBe("Cuota laptop");
    expect(item.linked_box_balance).toBe(60);
  });

  it("previsualiza cuotas mensuales, ajusta fin de mes y suma exactamente el principal", () => {
    const preview = buildInstallmentSchedulePreview({
      principalAmount: 100,
      installmentCount: 3,
      installmentAmount: null,
      firstDueDate: "2026-01-31",
    });
    expect(preview.map((item) => item.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(preview.map((item) => item.amount)).toEqual([33.33, 33.33, 33.34]);
    expect(preview.reduce((sum, item) => sum + item.amount, 0)).toBe(100);
  });

  it("solo precarga la cuota abierta más antigua", () => {
    const debt = detailFixture({
      installments: [
        installment({ id: "i-2", number: 2, due_date: "2026-09-01" }),
        installment({
          id: "i-1",
          number: 1,
          due_date: "2026-08-01",
          expected_amount: 300,
          paid_amount: 100,
        }),
      ],
    });
    expect(resolveDebtInstallmentPaymentTarget(debt, "i-1")).toEqual({
      installment_id: "i-1",
      installment_number: 1,
      amount: 200,
    });
    expect(resolveDebtInstallmentPaymentTarget(debt, "i-2")).toBeNull();
  });

  it("explica cada asignación del historial con monto y cuota", () => {
    const detail = toDebtDetailViewModel(
      detailFixture({
        installments: [
          installment({ id: "i-1", number: 1 }),
          installment({ id: "i-2", number: 2 }),
        ],
        payments: [
          {
            id: "payment-1",
            user_id: "user-1",
            debt_id: "debt-1",
            movement_id: "movement-1",
            amount: 500,
            currency: "PEN",
            paid_at: "2026-07-29T12:00:00-05:00",
            source: "dashboard_manual",
            metadata: {},
            created_at: "2026-07-29T17:00:00.000Z",
            movement: null,
            allocations: [
              allocation("i-1", 200, 1),
              allocation("i-2", 300, 2),
            ],
          },
        ],
      }),
      new Date("2026-07-29T18:00:00.000Z")
    );
    expect(detail.history[0].allocation_lines).toEqual([
      expect.stringContaining("S/200.00 a cuota 1"),
      expect.stringContaining("S/300.00 a cuota 2"),
    ]);
  });

  it("conserva un pago revertido como evidencia explícita, no como pago normal", () => {
    const detail = toDebtDetailViewModel(
      detailFixture({
        payments: [
          {
            id: "payment-reversed",
            user_id: "user-1",
            debt_id: "debt-1",
            movement_id: "movement-reversed",
            amount: 75,
            currency: "PEN",
            paid_at: "2026-07-20T12:00:00-05:00",
            reversed_at: "2026-07-21T09:00:00-05:00",
            reversal_reason: "Pago duplicado",
            source: "dashboard_manual",
            metadata: {},
            created_at: "2026-07-20T17:00:00.000Z",
            movement: null,
            allocations: [],
          },
        ],
      }),
      new Date("2026-07-29T18:00:00.000Z")
    );

    expect(detail.history[0]).toMatchObject({
      id: "payment-reversed",
      is_reversed: true,
      type_label: "Pago revertido",
      reversal_reason: "Pago duplicado",
    });
  });

  it("formatea soles sin separar el símbolo", () => {
    expect(formatDebtMoney(20)).toBe("S/20.00");
  });
});

function debtFixture(
  overrides: Partial<DebtWithPerson> = {}
): DebtWithPerson {
  return {
    id: "debt-1",
    user_id: "user-1",
    direction: "i_owe",
    kind: "personal",
    status: "active",
    related_person_id: null,
    related_person: null,
    linked_box: null,
    name: "Préstamo con Luis",
    principal_amount: 150,
    current_balance: 100,
    currency: "PEN",
    opened_at: "2026-06-01",
    due_date: null,
    next_payment_date: null,
    installment_count: null,
    installment_amount: null,
    interest_notes: null,
    source: "dashboard_manual",
    confidence: 1,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: null,
    closed_at: null,
    ...overrides,
  };
}

function detailFixture(
  overrides: Partial<DebtDetailWithPayments> = {}
): DebtDetailWithPayments {
  return {
    ...debtFixture(),
    payments: [],
    installments: [],
    ...overrides,
  };
}

function installment(
  overrides: Partial<DebtDetailWithPayments["installments"][number]> = {}
): DebtDetailWithPayments["installments"][number] {
  return {
    id: "i-1",
    user_id: "user-1",
    debt_id: "debt-1",
    number: 1,
    due_date: "2026-08-01",
    expected_amount: 300,
    paid_amount: 0,
    status: "pending",
    movement_id: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    movement: null,
    allocations: [],
    ...overrides,
  };
}

function allocation(
  installmentId: string,
  amount: number,
  order: number
) {
  return {
    id: `allocation-${order}`,
    user_id: "user-1",
    debt_id: "debt-1",
    debt_payment_id: "payment-1",
    debt_installment_id: installmentId,
    movement_id: "movement-1",
    allocated_amount: amount,
    allocation_order: order,
    policy: "oldest_open_due_date_first_v1",
    metadata: {},
    created_at: "2026-07-29T17:00:00.000Z",
  };
}
