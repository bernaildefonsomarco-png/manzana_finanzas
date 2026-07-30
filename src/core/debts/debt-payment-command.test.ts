import { describe, expect, it, vi } from "vitest";
import { CommandDispatcher } from "@/core/finance";
import { InMemoryFinancialCoreRepository } from "@/core/finance/in-memory-repository";
import type { RecordDebtPaymentCommand } from "@/core/finance/commands";
import type {
  Debt,
  DebtInstallment,
  DebtPayment,
  Movement,
} from "@/shared/types/domain";
import {
  DebtPaymentCommandHandler,
  type DebtPaymentCommitInput,
  type DebtPaymentExecutionPort,
} from "./debt-payment-command";

const userId = "00000000-0000-4000-8000-000000000001";
const debtId = "00000000-0000-4000-8000-0000000000d1";
const installmentId = "00000000-0000-4000-8000-0000000000e1";

describe("RecordDebtPaymentCommand", () => {
  it("registra un pago parcial por el commit transaccional especializado", async () => {
    const port = fakePort();
    const result = await dispatcher(port).dispatch(command());

    expect(result.type).toBe("debt_payment_recorded");
    if (result.type !== "debt_payment_recorded") return;
    expect(result.movement.type).toBe("pago_deuda");
    expect(result.movement.debt_id).toBe(debtId);
    expect(result.debt.current_balance).toBe(70);
    expect(port.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        debtId,
        payment: expect.objectContaining({ amount: 30, source: "whatsapp" }),
        movementCommit: expect.objectContaining({
          movement: expect.objectContaining({
            type: "pago_deuda",
            debt_id: debtId,
            account_origin_id: null,
          }),
        }),
      }),
    );
  });

  it("crea debt_paid al liquidar el saldo completo", async () => {
    const port = fakePort();
    await dispatcher(port).dispatch(command({ amount: 100 }));

    const input = port.commit.mock.calls[0][0];
    expect(
      input.debtOutboxEvents.map((event) => event.event_type),
    ).toEqual(["debt_payment_registered", "debt_paid"]);
  });

  it("bloquea sobrepago antes del RPC", async () => {
    const port = fakePort();

    await expect(
      dispatcher(port).dispatch(command({ amount: 101 })),
    ).rejects.toMatchObject({ code: "DEBT_PAYMENT_EXCEEDS_BALANCE" });
    expect(port.commit).not.toHaveBeenCalled();
  });

  it("bloquea moneda distinta a la deuda", async () => {
    const port = fakePort();

    await expect(
      dispatcher(port).dispatch(command({ currency: "USD" })),
    ).rejects.toMatchObject({ code: "DEBT_PAYMENT_CURRENCY_MISMATCH" });
    expect(port.commit).not.toHaveBeenCalled();
  });

  it("bloquea una cuota posterior porque el RPC asigna a la mas antigua", async () => {
    const first = installmentFixture();
    const second = installmentFixture({
      id: "00000000-0000-4000-8000-0000000000e2",
      number: 2,
      due_date: "2026-09-01",
    });
    const port = fakePort({ installments: [first, second] });

    await expect(
      dispatcher(port).dispatch(
        command({
          installment_id: second.id,
          installment_number: second.number,
        }),
      ),
    ).rejects.toMatchObject({ code: "DEBT_INSTALLMENT_NOT_ACTIONABLE" });
    expect(port.commit).not.toHaveBeenCalled();
  });

  it("devuelve el mismo pago en un retry idempotente", async () => {
    const port = fakePort();
    const existing = await port.commit(buildCommitInput(command()));
    port.findByIdempotencyKey.mockResolvedValue(existing);
    port.commit.mockClear();

    const result = await dispatcher(port).dispatch(command());

    expect(result).toMatchObject({
      type: "debt_payment_recorded",
      idempotent: true,
      movement: { id: existing.movement.id },
    });
    expect(port.commit).not.toHaveBeenCalled();
  });

  it("rechaza reutilizar la llave con un monto distinto", async () => {
    const original = command();
    const port = fakePort();
    const existing = await port.commit(buildCommitInput(original));
    port.findByIdempotencyKey.mockResolvedValue(existing);
    port.commit.mockClear();

    await expect(
      dispatcher(port).dispatch(command({ amount: 31 })),
    ).rejects.toMatchObject({
      code: "DEBT_PAYMENT_IDEMPOTENCY_CONFLICT",
    });
    expect(port.commit).not.toHaveBeenCalled();
  });
});

function dispatcher(port: ReturnType<typeof fakePort>) {
  return new CommandDispatcher(new InMemoryFinancialCoreRepository(), {
    debtPaymentHandler: new DebtPaymentCommandHandler(port),
  });
}

function command(
  overrides: Partial<RecordDebtPaymentCommand["payload"]> = {},
): RecordDebtPaymentCommand {
  return {
    type: "RecordDebtPaymentCommand",
    command_id: "00000000-0000-4000-8000-0000000000c1",
    user_id: userId,
    actor: { type: "agent", id: null },
    source: "orchestrator.whatsapp.data_agent.debt_payment",
    trace_id: "00000000-0000-4000-8000-0000000000f1",
    payload: {
      debt_id: debtId,
      amount: 30,
      currency: "PEN",
      account_id: null,
      installment_id: installmentId,
      installment_number: 1,
      paid_at: "2026-07-22T10:00:00.000-05:00",
      note: "Primera cuota de Pedro",
      idempotency_key: "whatsapp:event-1:action-1",
      payment_source: "whatsapp",
      ...overrides,
    },
  };
}

function fakePort(
  options: { installments?: DebtInstallment[]; debt?: Debt } = {},
) {
  const debt = options.debt ?? debtFixture();
  const installments = options.installments ?? [installmentFixture()];
  const port = {
    findByIdempotencyKey: vi.fn<DebtPaymentExecutionPort["findByIdempotencyKey"]>(
      async () => null,
    ),
    getDebt: vi.fn<DebtPaymentExecutionPort["getDebt"]>(async () => debt),
    getAccount: vi.fn<DebtPaymentExecutionPort["getAccount"]>(async () => null),
    listInstallments: vi.fn<DebtPaymentExecutionPort["listInstallments"]>(
      async () => installments,
    ),
    commit: vi.fn<DebtPaymentExecutionPort["commit"]>(async (input) => {
      const movement = {
        ...input.movementCommit.movement,
        created_at: "2026-07-22T15:00:00.000Z",
        updated_at: "2026-07-22T15:00:00.000Z",
      } as Movement;
      const payment = {
        ...input.payment,
        movement_id: movement.id,
        created_at: "2026-07-22T15:00:00.000Z",
      } as DebtPayment;
      return {
        movement,
        debt: {
          ...debt,
          current_balance: Math.round((debt.current_balance - payment.amount) * 100) / 100,
        },
        payment,
        installment_allocations: [],
        allocation_policy: "oldest_open_due_date_first_v1",
        idempotent: false,
      };
    }),
    refreshLifecycle: vi.fn<DebtPaymentExecutionPort["refreshLifecycle"]>(
      async () => undefined,
    ),
  };
  return port;
}

function buildCommitInput(value: RecordDebtPaymentCommand): DebtPaymentCommitInput {
  const debt = debtFixture();
  const movement = {
    id: "00000000-0000-4000-8000-0000000000a1",
    user_id: userId,
    type: "pago_deuda",
    status: "confirmed",
    amount: value.payload.amount,
    currency: debt.currency,
    occurred_at: value.payload.paid_at,
    description: value.payload.note,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    source: "whatsapp",
    source_ref: null,
    idempotency_key: value.payload.idempotency_key,
    confidence: 1,
    requires_review: false,
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_id: debt.id,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    related_person_id: debt.related_person_id,
    affects_total_balance: false,
    affects_account_balance: false,
    deleted_at: null,
    metadata: {},
  } as const;
  return {
    debtId: debt.id,
    payment: {
      id: "00000000-0000-4000-8000-0000000000b1",
      user_id: userId,
      debt_id: debt.id,
      movement_id: movement.id,
      amount: value.payload.amount,
      currency: debt.currency,
      paid_at: value.payload.paid_at,
      source: "whatsapp",
      metadata: {
        note: value.payload.note,
        idempotency_key: value.payload.idempotency_key,
        previous_balance: debt.current_balance,
        projected_balance:
          Math.round((debt.current_balance - value.payload.amount) * 100) / 100,
        installment_id: value.payload.installment_id,
        installment_number: value.payload.installment_number,
      },
    },
    movementCommit: {
      movement,
      auditLogs: [],
      accountDeltas: [],
      boxDeltas: [],
      outboxEvents: [],
    },
    debtOutboxEvents: [],
  };
}

function debtFixture(): Debt {
  return {
    id: debtId,
    user_id: userId,
    direction: "i_owe",
    kind: "personal",
    status: "active",
    related_person_id: null,
    name: "Prestamo Pedro",
    principal_amount: 100,
    current_balance: 100,
    currency: "PEN",
    opened_at: "2026-07-01",
    due_date: "2026-08-01",
    next_payment_date: "2026-08-01",
    installment_count: 2,
    installment_amount: 50,
    interest_notes: null,
    source: "dashboard_manual",
    confidence: 1,
    metadata: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: null,
    closed_at: null,
  };
}

function installmentFixture(
  overrides: Partial<DebtInstallment> = {},
): DebtInstallment {
  return {
    id: installmentId,
    user_id: userId,
    debt_id: debtId,
    number: 1,
    due_date: "2026-08-01",
    expected_amount: 50,
    paid_amount: 0,
    status: "pending",
    movement_id: null,
    metadata: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}
