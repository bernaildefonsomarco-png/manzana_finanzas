import { describe, expect, it, vi } from "vitest";

import { CommandDispatcher } from "@/core/finance";
import type { CreateDebtCommand } from "@/core/finance/commands";
import { InMemoryFinancialCoreRepository } from "@/core/finance/in-memory-repository";
import type {
  Account,
  Debt,
  DebtInstallment,
  Movement,
} from "@/shared/types/domain";
import {
  DebtCreationCommandHandler,
  type DebtCreationExecutionPort,
} from "./debt-creation-command";

const userId = "00000000-0000-4000-8000-000000000001";
const accountId = "00000000-0000-4000-8000-0000000000aa";

describe("CreateDebtCommand", () => {
  it("crea deuda y calendario mensual sin inventar un movimiento ni tocar cuentas", async () => {
    const port = fakePort();
    const result = await dispatcher(port).dispatch(command());

    expect(result.type).toBe("debt_created");
    if (result.type !== "debt_created") return;
    expect(result.debt).toMatchObject({
      direction: "i_owe",
      principal_amount: 100,
      current_balance: 100,
      related_person_id: null,
    });
    expect(result.installments.map((item) => item.due_date)).toEqual([
      "2026-07-30",
      "2026-08-30",
      "2026-09-30",
      "2026-10-30",
      "2026-11-30",
    ]);
    expect(result.installments.map((item) => item.expected_amount)).toEqual([
      20, 20, 20, 20, 20,
    ]);
    expect(result.loan_movement).toBeNull();
    expect(port.getAccount).not.toHaveBeenCalled();
    expect(port.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        normalizedRelatedPersonName: "juan",
        movementCommit: null,
        outboxEvents: [
          expect.objectContaining({
            event_type: "debt_created",
            aggregate_type: "debt",
          }),
        ],
      }),
    );
  });

  it("acepta deuda_adquirida sin cuenta y no crea movimiento (WEB-D198)", async () => {
    const port = fakePort();
    const result = await dispatcher(port).dispatch(
      command({ movement_type: "deuda_adquirida", account_id: null }),
    );

    expect(result.type).toBe("debt_created");
    if (result.type !== "debt_created") return;
    expect(result.loan_movement).toBeNull();
    expect(port.commit).toHaveBeenCalledWith(
      expect.objectContaining({ movementCommit: null }),
    );
  });

  it("permite crear una deuda sin persona relacionada", async () => {
    const port = fakePort();
    const result = await dispatcher(port).dispatch(
      command({ related_person_name: null }),
    );

    expect(result.type).toBe("debt_created");
    expect(port.commit).toHaveBeenCalledWith(
      expect.objectContaining({ normalizedRelatedPersonName: null }),
    );
  });

  it("rechaza deuda_adquirida con cuenta: no hay movimiento de efectivo que registrar", async () => {
    const port = fakePort({ account: accountFixture() });
    await expect(
      dispatcher(port).dispatch(
        command({ movement_type: "deuda_adquirida", account_id: accountId }),
      ),
    ).rejects.toThrow();
  });

  it("rechaza movement_type que no coincide con la direccion", async () => {
    const port = fakePort();
    await expect(
      dispatcher(port).dispatch(
        command({ direction: "they_owe_me", movement_type: "deuda_adquirida" }),
      ),
    ).rejects.toThrow();
    await expect(
      dispatcher(port).dispatch(
        command({ direction: "i_owe", movement_type: "prestamo_dado" }),
      ),
    ).rejects.toThrow();
  });

  it("ajusta el ultimo importe para que el calendario sume exactamente el principal", async () => {
    const port = fakePort();
    await dispatcher(port).dispatch(
      command({
        principal_amount: 100,
        installment_count: 3,
        installment_amount: null,
        first_due_date: "2026-01-31",
      }),
    );

    const input = port.commit.mock.calls[0][0];
    expect(input.installments.map((item) => item.due_date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    expect(input.installments.map((item) => item.expected_amount)).toEqual([
      33.33, 33.33, 33.34,
    ]);
    expect(
      input.installments.reduce(
        (sum, installment) => sum + installment.expected_amount,
        0,
      ),
    ).toBe(100);
  });

  it("solo crea el movimiento de prestamo cuando el usuario vincula una cuenta valida", async () => {
    const port = fakePort({ account: accountFixture() });
    const result = await dispatcher(port).dispatch(
      command({ account_id: accountId }),
    );

    expect(result.type).toBe("debt_created");
    if (result.type !== "debt_created") return;
    expect(port.getAccount).toHaveBeenCalledWith(userId, accountId);
    expect(port.commit).toHaveBeenCalledWith(
      expect.objectContaining({
        movementCommit: expect.objectContaining({
          movement: expect.objectContaining({
            type: "prestamo_recibido",
            amount: 100,
            debt_id: expect.any(String),
            account_origin_id: null,
            account_destination_id: accountId,
          }),
        }),
      }),
    );
    expect(result.loan_movement).toMatchObject({
      type: "prestamo_recibido",
      account_destination_id: accountId,
    });
  });

  it("rechaza cuenta inexistente o con moneda distinta antes del commit", async () => {
    const missingAccount = fakePort({ account: null });
    await expect(
      dispatcher(missingAccount).dispatch(command({ account_id: accountId })),
    ).rejects.toMatchObject({ code: "DEBT_CREATION_ACCOUNT_NOT_FOUND" });
    expect(missingAccount.commit).not.toHaveBeenCalled();

    const mismatchedCurrency = fakePort({
      account: accountFixture({ currency: "USD" }),
    });
    await expect(
      dispatcher(mismatchedCurrency).dispatch(
        command({ account_id: accountId }),
      ),
    ).rejects.toMatchObject({
      code: "DEBT_CREATION_ACCOUNT_CURRENCY_MISMATCH",
    });
    expect(mismatchedCurrency.commit).not.toHaveBeenCalled();
  });

  it("devuelve el resultado idempotente que garantiza el commit especializado", async () => {
    const port = fakePort({ idempotent: true });
    const result = await dispatcher(port).dispatch(command());

    expect(result).toMatchObject({
      type: "debt_created",
      idempotent: true,
      debt: { name: "Deuda con Juan" },
    });
    expect(port.commit).toHaveBeenCalledTimes(1);
  });

  it("falla cerrado si el dispatcher no tiene el handler especializado", async () => {
    await expect(
      new CommandDispatcher(
        new InMemoryFinancialCoreRepository(),
      ).dispatch(command()),
    ).rejects.toMatchObject({ code: "DEBT_CREATION_HANDLER_UNAVAILABLE" });
  });
});

function dispatcher(port: ReturnType<typeof fakePort>) {
  return new CommandDispatcher(new InMemoryFinancialCoreRepository(), {
    debtCreationHandler: new DebtCreationCommandHandler(port),
  });
}

function command(
  overrides: Partial<CreateDebtCommand["payload"]> = {},
): CreateDebtCommand {
  return {
    type: "CreateDebtCommand",
    command_id: "00000000-0000-4000-8000-0000000000c1",
    user_id: userId,
    actor: { type: "agent", id: null },
    source: "orchestrator.whatsapp.data_agent.debt_creation",
    trace_id: "00000000-0000-4000-8000-0000000000f1",
    payload: {
      direction: "i_owe",
      kind: "personal",
      name: "Deuda con Juan",
      related_person_name: "Juan",
      principal_amount: 100,
      currency: "PEN",
      opened_at: "2026-07-24",
      first_due_date: "2026-07-30",
      installment_count: 5,
      installment_amount: 20,
      interest_notes: null,
      account_id: null,
      movement_type: "prestamo_recibido",
      idempotency_key: "whatsapp:event-1:action-1",
      creation_source: "whatsapp",
      ...overrides,
    },
  };
}

function fakePort(
  options: { account?: Account | null; idempotent?: boolean } = {},
) {
  const hasAccountOption = Object.prototype.hasOwnProperty.call(
    options,
    "account",
  );
  const port = {
    getAccount: vi.fn<DebtCreationExecutionPort["getAccount"]>(
      async () => (hasAccountOption ? options.account ?? null : null),
    ),
    commit: vi.fn<DebtCreationExecutionPort["commit"]>(async (input) => {
      const now = "2026-07-24T17:00:00.000Z";
      const debt = {
        id: input.debtId,
        user_id: input.command.user_id,
        direction: input.command.payload.direction,
        kind: input.command.payload.kind,
        status: "active",
        related_person_id: null,
        name: input.command.payload.name,
        principal_amount: input.command.payload.principal_amount,
        current_balance: input.command.payload.principal_amount,
        currency: input.command.payload.currency,
        opened_at: input.command.payload.opened_at,
        due_date: input.installments.at(-1)?.due_date ?? null,
        next_payment_date: input.installments[0]?.due_date ?? null,
        installment_count: input.command.payload.installment_count,
        installment_amount: input.command.payload.installment_amount,
        interest_notes: input.command.payload.interest_notes,
        source: input.command.payload.creation_source,
        confidence: 1,
        metadata: {},
        created_at: now,
        updated_at: now,
        deleted_at: null,
        last_payment_at: null,
        closed_at: null,
      } satisfies Debt;
      const installments = input.installments.map(
        (installment) =>
          ({
            ...installment,
            movement_id: null,
            created_at: now,
            updated_at: now,
          }) satisfies DebtInstallment,
      );
      const loanMovement = input.movementCommit
        ? ({
            ...input.movementCommit.movement,
            created_at: now,
            updated_at: now,
          } as Movement)
        : null;
      return {
        debt,
        installments,
        loan_movement: loanMovement,
        idempotent: options.idempotent ?? false,
      };
    }),
  };
  return port;
}

function accountFixture(overrides: Partial<Account> = {}): Account {
  return {
    id: accountId,
    user_id: userId,
    name: "Cuenta principal",
    institution: null,
    type: "banco",
    currency: "PEN",
    initial_balance: 0,
    current_balance: 0,
    is_default: true,
    color: null,
    icon: null,
    metadata: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    deleted_at: null,
    ...overrides,
  };
}
