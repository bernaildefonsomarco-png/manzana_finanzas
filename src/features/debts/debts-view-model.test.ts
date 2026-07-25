import { describe, expect, it } from "vitest";
import type { DebtDetailWithPayments, DebtWithPerson } from "./debts-types";
import {
  formatDebtMoney,
  resolveDebtInstallmentPaymentTarget,
  summarizeDebts,
  toDebtDetailViewModel,
  toDebtViewItem,
} from "./debts-view-model";

const baseDebt: DebtWithPerson = {
  id: "debt-1",
  user_id: "user-1",
  direction: "i_owe",
  kind: "personal",
  status: "active",
  related_person_id: null,
  related_person: null,
  name: "Prestamo con Luis",
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
};

describe("debts view model", () => {
  it("resume lo que debo, lo que me deben y el neto", () => {
    const summary = summarizeDebts([
      baseDebt,
      {
        ...baseDebt,
        id: "debt-2",
        direction: "they_owe_me",
        current_balance: 40,
      },
    ]);

    expect(summary.total_i_owe).toBe(100);
    expect(summary.total_they_owe_me).toBe(40);
    expect(summary.net_position).toBe(-60);
    expect(summary.active_count).toBe(2);
  });

  it("calcula progreso pagado desde principal y saldo pendiente", () => {
    const item = toDebtViewItem(baseDebt);

    expect(item.paid_amount).toBe(50);
    expect(item.progress).toBe(33);
    expect(item.direction_label).toBe("Yo debo");
  });

  it("formatea soles con etiqueta local", () => {
    expect(formatDebtMoney(20, "PEN")).toContain("S/");
  });

  it("prepara detalle con historial de pagos y movimiento Core", () => {
    const detail = toDebtDetailViewModel(
      {
        ...baseDebt,
        last_payment_at: "2026-06-29T15:00:00.000Z",
        payments: [
          {
            id: "payment-1",
            user_id: "user-1",
            debt_id: "debt-1",
            movement_id: "movement-1",
            amount: 30,
            currency: "PEN",
            paid_at: "2026-06-29T15:00:00.000Z",
            source: "dashboard_manual",
            metadata: {},
            created_at: "2026-06-29T15:00:00.000Z",
            movement: {
              id: "movement-1",
              user_id: "user-1",
              type: "pago_deuda",
              status: "confirmed",
              amount: 30,
              currency: "PEN",
              occurred_at: "2026-06-29T15:00:00.000Z",
              description: "Pago de Prestamo con Luis",
              merchant: null,
              category_id: null,
              subcategory_id: null,
              source: "dashboard_manual",
              source_ref: "dashboard-debt-payment:test",
              idempotency_key: "idem-1",
              confidence: 1,
              requires_review: false,
              account_origin_id: "account-1",
              account_destination_id: null,
              box_origin_id: null,
              box_destination_id: null,
              debt_id: "debt-1",
              recurring_rule_id: null,
              recurring_occurrence_id: null,
              related_person_id: null,
              affects_total_balance: true,
              affects_account_balance: true,
              created_at: "2026-06-29T15:00:00.000Z",
              updated_at: "2026-06-29T15:00:00.000Z",
              deleted_at: null,
              metadata: {},
            },
            allocations: [
              {
                id: "allocation-1",
                user_id: "user-1",
                debt_id: "debt-1",
                debt_payment_id: "payment-1",
                debt_installment_id: "installment-1",
                movement_id: "movement-1",
                allocated_amount: 30,
                allocation_order: 1,
                policy: "oldest_open_due_date_first_v1",
                metadata: {},
                created_at: "2026-06-29T15:00:00.000Z",
              },
            ],
          },
        ],
        installments: [
          {
            id: "installment-1",
            user_id: "user-1",
            debt_id: "debt-1",
            number: 1,
            due_date: "2026-06-30",
            expected_amount: 50,
            paid_amount: 30,
            status: "pending",
            movement_id: "movement-1",
            metadata: {},
            created_at: "2026-06-01T00:00:00.000Z",
            updated_at: "2026-06-01T00:00:00.000Z",
            movement: null,
            allocations: [
              {
                id: "allocation-1",
                user_id: "user-1",
                debt_id: "debt-1",
                debt_payment_id: "payment-1",
                debt_installment_id: "installment-1",
                movement_id: "movement-1",
                allocated_amount: 30,
                allocation_order: 1,
                policy: "oldest_open_due_date_first_v1",
                metadata: {},
                created_at: "2026-06-29T15:00:00.000Z",
              },
            ],
          },
        ],
      } satisfies DebtDetailWithPayments,
      new Date("2026-06-29T16:00:00.000Z")
    );

    expect(detail.title).toBe("Prestamo con Luis");
    expect(detail.last_payment_label).toBe("Hoy");
    expect(detail.history).toHaveLength(1);
    expect(detail.history[0].type_label).toBe("Pago de deuda");
    expect(detail.history[0].movement_label).toBe("Movimiento Core con cuenta");
    expect(detail.history[0].allocation_label).toBe("Aplicado a cuota 1");
    expect(detail.installments).toHaveLength(1);
    expect(detail.installments[0].due_label).toBe("Vence manana");
    expect(detail.installments[0].status_label).toBe("Por vencer");
    expect(detail.installments[0].pending_amount_label).toContain("20.00");
    expect(detail.installments[0].movement_label).toBe("1 abono vinculado");
  });

  it("solo resuelve como pagable la cuota abierta mas antigua", () => {
    const debt = {
      ...baseDebt,
      payments: [],
      installments: [
        installmentFixture({
          id: "installment-2",
          number: 2,
          due_date: "2026-08-01",
        }),
        installmentFixture({
          id: "installment-1",
          number: 1,
          due_date: "2026-07-01",
          expected_amount: 50,
          paid_amount: 30,
        }),
      ],
    } satisfies DebtDetailWithPayments;

    expect(
      resolveDebtInstallmentPaymentTarget(debt, "installment-1")
    ).toEqual({
      installment_id: "installment-1",
      installment_number: 1,
      amount: 20,
    });
    expect(
      resolveDebtInstallmentPaymentTarget(debt, "installment-2")
    ).toBeNull();
  });

  it("separa saldo actual y calendario cuando no coinciden", () => {
    const detail = toDebtDetailViewModel(
      {
        ...baseDebt,
        current_balance: 30,
        principal_amount: 30,
        installments: [
          installmentFixture({ id: "i-1", number: 1, expected_amount: 30 }),
          installmentFixture({ id: "i-2", number: 2, expected_amount: 30 }),
          installmentFixture({ id: "i-3", number: 3, expected_amount: 30 }),
        ],
        payments: [],
      } satisfies DebtDetailWithPayments,
      new Date("2026-07-01T12:00:00.000Z")
    );

    expect(detail.schedule_pending_amount).toBe(90);
    expect(detail.schedule_balance_gap).toBe(-60);
    expect(detail.schedule_warning).toContain("30.00");
    expect(detail.schedule_warning).toContain("90.00");
  });
});

function installmentFixture(
  overrides: Partial<DebtDetailWithPayments["installments"][number]> = {}
): DebtDetailWithPayments["installments"][number] {
  return {
    id: overrides.id ?? "installment-1",
    user_id: "user-1",
    debt_id: "debt-1",
    number: overrides.number ?? 1,
    due_date: overrides.due_date ?? "2026-07-01",
    expected_amount: overrides.expected_amount ?? 50,
    paid_amount: overrides.paid_amount ?? 0,
    status: overrides.status ?? "pending",
    movement_id: overrides.movement_id ?? null,
    metadata: overrides.metadata ?? {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    movement: overrides.movement ?? null,
    allocations: overrides.allocations ?? [],
  };
}
