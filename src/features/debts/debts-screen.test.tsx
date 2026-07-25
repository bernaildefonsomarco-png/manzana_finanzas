import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DebtsScreen } from "./debts-screen";

const mocks = vi.hoisted(() => ({
  createDebt: vi.fn(),
  createDebtPayment: vi.fn(),
  getDebtDetail: vi.fn(),
  listDebtPaymentAccounts: vi.fn(),
  listDebts: vi.fn(),
}));

vi.mock("./debts-api", () => mocks);

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
});

describe("debts screen intent", () => {
  it("abre el pago con el pendiente real de la cuota mas antigua", async () => {
    const debt = debtFixture();
    const onDebtIntentConsumed = vi.fn();
    mocks.listDebts.mockResolvedValue({ debts: [debt] });
    mocks.getDebtDetail.mockResolvedValue({
      ...debt,
      payments: [],
      installments: [
        {
          id: "22222222-2222-4222-8222-222222222222",
          user_id: debt.user_id,
          debt_id: debt.id,
          number: 1,
          due_date: "2026-07-01",
          expected_amount: 80,
          paid_amount: 30,
          status: "pending",
          movement_id: null,
          metadata: {},
          created_at: "2026-06-01T00:00:00.000Z",
          updated_at: "2026-06-01T00:00:00.000Z",
          movement: null,
          allocations: [],
        },
      ],
    });
    mocks.listDebtPaymentAccounts.mockResolvedValue({ accounts: [] });

    render(
      <DebtsScreen
        debtIntent={{
          debtId: debt.id,
          installmentId: "22222222-2222-4222-8222-222222222222",
          action: "pay",
        }}
        onDebtIntentConsumed={onDebtIntentConsumed}
      />
    );

    const amountInput = await screen.findByLabelText("Monto pagado");

    expect((amountInput as HTMLInputElement).value).toBe("50");
    expect(screen.getByText("Cuota 1")).toBeTruthy();
    expect(
      screen.getAllByRole("button", { name: "Crear deuda" })
    ).toHaveLength(1);
    expect(onDebtIntentConsumed).toHaveBeenCalledOnce();
  });
});

function debtFixture() {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "33333333-3333-4333-8333-333333333333",
    direction: "i_owe",
    kind: "installment_purchase",
    status: "active",
    related_person_id: null,
    related_person: null,
    name: "Laptop",
    principal_amount: 160,
    current_balance: 130,
    currency: "PEN",
    opened_at: "2026-06-01",
    due_date: "2026-07-01",
    next_payment_date: "2026-07-01",
    installment_count: 2,
    installment_amount: 80,
    interest_notes: null,
    source: "dashboard_manual",
    confidence: 1,
    metadata: {},
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-01T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: "2026-06-15T12:00:00.000Z",
    closed_at: null,
  };
}
