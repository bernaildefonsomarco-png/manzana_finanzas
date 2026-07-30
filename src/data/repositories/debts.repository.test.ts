import { describe, expect, it, vi } from "vitest";
import type { Debt } from "@/shared/types/domain";
import {
  buildDebtInstallmentCommitments,
  buildDebtInstallmentDrafts,
  closeDebt,
  listDebtInstallmentCommitments,
  previewDebtPaymentAllocation,
  reopenDebt,
  rescheduleDebtInstallment,
  skipDebtInstallment,
  sortDebtsByNextPaymentDate,
} from "./debts.repository";
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

  it("RUL-DEUDAS-03: reparte S/500 oldest-first como 200 + 300 y deja saldo S/600", () => {
    const installments = [
      installment({
        id: "10000000-0000-4000-8000-000000000001",
        number: 1,
        due_date: "2026-08-01",
        expected_amount: 300,
        paid_amount: 100,
      }),
      installment({
        id: "10000000-0000-4000-8000-000000000002",
        number: 2,
        due_date: "2026-09-01",
        expected_amount: 300,
      }),
      installment({
        id: "10000000-0000-4000-8000-000000000003",
        number: 3,
        due_date: "2026-10-01",
        expected_amount: 300,
      }),
      installment({
        id: "10000000-0000-4000-8000-000000000004",
        number: 4,
        due_date: "2026-11-01",
        expected_amount: 300,
      }),
    ];

    const preview = previewDebtPaymentAllocation({
      amount: 500,
      currentBalance: 1100,
      installments,
    });

    expect(preview.allocations.map((item) => item.allocated_amount)).toEqual([
      200, 300,
    ]);
    expect(preview.allocations.map((item) => item.installment_number)).toEqual([
      1, 2,
    ]);
    expect(preview.projected_balance).toBe(600);
    expect(preview.unallocated_amount).toBe(0);
  });

  it("usa boxes.linked_debt_id como caja canónica y excluye they_owe_me", () => {
    const ownInstallment = installment();
    const receivableInstallment = installment({
      id: "10000000-0000-4000-8000-000000000099",
      debt_id: "20000000-0000-4000-8000-000000000099",
    });
    const rows = [
      {
        ...ownInstallment,
        debts: {
          id: ownInstallment.debt_id,
          name: "Laptop",
          currency: "PEN",
          direction: "i_owe",
          boxes: [
            {
              id: "30000000-0000-4000-8000-000000000001",
              linked_debt_id: ownInstallment.debt_id,
              deleted_at: null,
            },
          ],
        },
      },
      {
        ...receivableInstallment,
        debts: {
          id: receivableInstallment.debt_id,
          name: "Préstamo dado",
          currency: "PEN",
          direction: "they_owe_me",
          boxes: [],
        },
      },
    ];

    expect(buildDebtInstallmentCommitments(rows)).toEqual([
      expect.objectContaining({
        debt_id: ownInstallment.debt_id,
        linked_box_id: "30000000-0000-4000-8000-000000000001",
        direction: "i_owe",
      }),
    ]);
  });

  it("no recorta silenciosamente la cuota 41 dentro del horizonte", async () => {
    const rows = Array.from({ length: 41 }, (_, index) => {
      const current = installment({
        id: `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
        number: index + 1,
      });
      return {
        ...current,
        debts: {
          id: current.debt_id,
          name: "Crédito de 41 cuotas",
          currency: "PEN",
          direction: "i_owe",
          kind: "bank_loan",
          metadata: {},
          boxes: [],
        },
      };
    });
    const { client, limit } = installmentCommitmentsClient(rows);

    const result = await listDebtInstallmentCommitments(
      client,
      baseDebt.user_id,
      30,
      new Date("2026-07-29T12:00:00-05:00")
    );

    expect(result).toHaveLength(41);
    expect(limit).not.toHaveBeenCalled();
  });

  it("RUL-DEUDAS-13: no cierra como pagada mientras exista saldo", async () => {
    const { client } = debtOperationClient(null, {
      message: "DEBT_OPERATION_PAID_WITH_BALANCE",
    });
    await expect(
      closeDebt(client, {
        userId: baseDebt.user_id,
        debt: { ...baseDebt, current_balance: 20 },
        reason: "paid",
        idempotencyKey: "close-paid-123",
        traceId: "trace-1",
      })
    ).rejects.toMatchObject({ code: "DEBT_OPERATION_INVALID" });
  });

  it("condonar conserva el saldo perdonado en metadata y lleva balance a cero", async () => {
    const debt = {
      ...baseDebt,
      status: "cancelled" as const,
      current_balance: 0,
      metadata: { forgiven_balance: 80 },
    };
    const { client, rpc } = debtOperationClient({
      debt,
      idempotent: false,
    });
    const result = await closeDebt(client, {
      userId: baseDebt.user_id,
      debt: { ...baseDebt, current_balance: 80 },
      reason: "forgiven",
      idempotencyKey: "close-forgiven-123",
      traceId: "trace-1",
    });
    expect(result.debt).toEqual(debt);
    expect(rpc).toHaveBeenCalledWith(
      "commit_debt_operation",
      expect.objectContaining({
        p_operation: "close",
        p_payload: { reason: "forgiven" },
      })
    );
  });

  it("solo reabre una condonada y restaura exactamente su saldo auditado", async () => {
    const reopened = {
      ...baseDebt,
      status: "active" as const,
      current_balance: 80,
    };
    const { client, rpc } = debtOperationClient({
      debt: reopened,
      idempotent: false,
    });
    const result = await reopenDebt(client, {
      userId: baseDebt.user_id,
      debt: {
        ...baseDebt,
        status: "cancelled",
        current_balance: 0,
        metadata: { forgiven_balance: 80 },
      },
      idempotencyKey: "reopen-forgiven-123",
      traceId: "trace-2",
    });
    expect(result.debt).toEqual(reopened);
    expect(rpc).toHaveBeenCalledWith(
      "commit_debt_operation",
      expect.objectContaining({ p_operation: "reopen", p_payload: {} })
    );
  });

  it("una deuda pagada exige ajuste nuevo y no se reabre silenciosamente", async () => {
    const { client } = debtOperationClient(null, {
      message: "DEBT_OPERATION_PAID_CANNOT_REOPEN",
    });
    await expect(
      reopenDebt(client, {
        userId: baseDebt.user_id,
        debt: { ...baseDebt, status: "paid", current_balance: 0 },
        idempotencyKey: "reopen-paid-123",
        traceId: "trace-3",
      })
    ).rejects.toMatchObject({ code: "DEBT_OPERATION_CONFLICT" });
  });

  it("reprograma una cuota sin cambiar sus montos y conserva la fecha previa", async () => {
    const current = installment();
    const changed = {
      ...current,
      due_date: "2026-09-15",
      metadata: {
        reschedule_history: [
          {
            from: "2026-08-01",
            to: "2026-09-15",
            reason: "Nuevo acuerdo",
          },
        ],
      },
    };
    const { client, rpc } = debtOperationClient({
      debt: baseDebt,
      installment: changed,
      idempotent: false,
    });
    const result = await rescheduleDebtInstallment(client, {
      userId: current.user_id,
      installment: current,
      dueDate: "2026-09-15",
      reason: "Nuevo acuerdo",
      idempotencyKey: "reschedule-123",
      traceId: "trace-4",
    });
    expect(result.installment).toEqual(changed);
    expect(rpc).toHaveBeenCalledWith(
      "commit_debt_operation",
      expect.objectContaining({
        p_operation: "reschedule_installment",
        p_payload: {
          installment_id: current.id,
          due_date: "2026-09-15",
          reason: "Nuevo acuerdo",
        },
      })
    );
    const payload = rpc.mock.calls[0]?.[1]?.p_payload as
      | Record<string, unknown>
      | undefined;
    expect(payload).not.toHaveProperty("expected_amount");
    expect(payload).not.toHaveProperty("paid_amount");
  });

  it("saltar una cuota es terminal y exige motivo auditable", async () => {
    const current = installment();
    const skipped = { ...current, status: "skipped" as const };
    const { client, rpc } = debtOperationClient({
      debt: baseDebt,
      installment: skipped,
      idempotent: false,
    });
    const result = await skipDebtInstallment(client, {
      userId: current.user_id,
      installment: current,
      reason: "Incluida en otro acuerdo",
      idempotencyKey: "skip-123456",
      traceId: "trace-5",
    });
    expect(result.installment).toEqual(skipped);
    expect(rpc).toHaveBeenCalledWith(
      "commit_debt_operation",
      expect.objectContaining({
        p_operation: "skip_installment",
        p_payload: {
          installment_id: current.id,
          reason: "Incluida en otro acuerdo",
        },
      })
    );
  });
});

function installment(
  overrides: Partial<import("@/shared/types/domain").DebtInstallment> = {}
): import("@/shared/types/domain").DebtInstallment {
  return {
    id: "10000000-0000-4000-8000-000000000000",
    user_id: baseDebt.user_id,
    debt_id: baseDebt.id,
    number: 1,
    due_date: "2026-08-01",
    expected_amount: 300,
    paid_amount: 0,
    status: "pending",
    movement_id: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function debtOperationClient(
  result: unknown,
  error: unknown = null
) {
  const rpc = vi.fn(
    async (_name: string, _params: Record<string, unknown>) => ({
      data: result,
      error,
    })
  );
  const client = {
    rpc,
  } as unknown as Parameters<typeof closeDebt>[0];
  return { client, rpc };
}

function installmentCommitmentsClient(rows: unknown[]) {
  let selectedRows = rows;
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "is", "lte", "order"]) {
    builder[method] = vi.fn(() => builder);
  }
  const limit = vi.fn((count: number) => {
    selectedRows = rows.slice(0, count);
    return builder;
  });
  builder.limit = limit;
  builder.then = (
    resolve: (value: { data: unknown[]; error: null }) => unknown
  ) => resolve({ data: selectedRows, error: null });
  const client = {
    from: vi.fn(() => builder),
  } as unknown as Parameters<typeof listDebtInstallmentCommitments>[0];
  return { client, limit };
}
