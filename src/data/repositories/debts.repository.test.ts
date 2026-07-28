import { describe, expect, it } from "vitest";
import type { Debt } from "@/shared/types/domain";
import { buildDebtInstallmentDrafts, sortDebtsByNextPaymentDate } from "./debts.repository";
import type { DebtWithPerson } from "./debts.repository";

const baseDebt: Debt = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "22222222-2222-4222-8222-222222222222",
  direction: "i_owe",
  kind: "installment_purchase",
  status: "active",
  related_person_id: null,
  name: "Laptop en cuotas",
  principal_amount: 100,
  current_balance: 100,
  currency: "PEN",
  opened_at: "2026-01-01",
  due_date: "2026-01-31",
  next_payment_date: "2026-01-31",
  installment_count: 3,
  installment_amount: null,
  interest_notes: null,
  source: "dashboard_manual",
  confidence: 1,
  metadata: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  deleted_at: null,
  last_payment_at: null,
  closed_at: null,
};

describe("debts repository helpers", () => {
  it("genera calendario mensual de cuotas sin inventar fecha cuando falta", () => {
    expect(
      buildDebtInstallmentDrafts({
        userId: baseDebt.user_id,
        debt: baseDebt,
        installmentCount: 3,
        installmentAmount: null,
        firstDueDate: null,
      })
    ).toEqual([]);
  });

  it("genera cuotas mensuales ajustando fin de mes y ultima cuota", () => {
    const drafts = buildDebtInstallmentDrafts({
      userId: baseDebt.user_id,
      debt: baseDebt,
      installmentCount: 3,
      installmentAmount: null,
      firstDueDate: "2026-01-31",
    });

    expect(drafts.map((draft) => draft.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(drafts.map((draft) => draft.expected_amount)).toEqual([
      33.33,
      33.33,
      33.34,
    ]);
    expect(drafts.map((draft) => draft.status)).toEqual([
      "pending",
      "pending",
      "pending",
    ]);
  });

  it("sortDebtsByNextPaymentDate: ordena por vencimiento mas proximo primero, nulls al final", () => {
    const withDate = (id: string, date: string | null): DebtWithPerson => ({
      ...baseDebt,
      id,
      next_payment_date: date,
      related_person: null,
    });

    const sorted = sortDebtsByNextPaymentDate([
      withDate("c", null),
      withDate("a", "2026-01-31"),
      withDate("b", "2026-02-15"),
    ]);

    expect(sorted.map((debt) => debt.id)).toEqual(["a", "b", "c"]);
  });
});
