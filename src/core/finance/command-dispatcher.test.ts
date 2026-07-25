import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "./command-dispatcher";
import { InMemoryFinancialCoreRepository } from "./in-memory-repository";
import type { CoreCommand, CreateMovementCommand } from "./commands";
import { CoreError } from "./errors";
import type { MovementInput } from "@/shared/schemas/money";

const userId = "00000000-0000-4000-8000-000000000001";
const accountA = "00000000-0000-4000-8000-0000000000aa";
const accountB = "00000000-0000-4000-8000-0000000000bb";
const boxA = "00000000-0000-4000-8000-0000000000cc";

function commandBase(): Omit<CoreCommand, "type" | "payload"> {
  return {
    command_id: randomUUID(),
    user_id: userId,
    actor: { type: "user", id: userId },
    source: "dashboard_manual",
    trace_id: randomUUID(),
  };
}

function movementInput(overrides: Partial<MovementInput> = {}): MovementInput {
  return {
    type: "gasto",
    amount: 8,
    currency: "PEN",
    occurred_at: "2026-06-06T10:00:00.000Z",
    description: "Cafe",
    merchant: null,
    category_id: "alimentacion",
    subcategory_id: null,
    account_origin_id: accountA,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: "dashboard_manual",
    source_ref: null,
    confidence: 1,
    requires_review: false,
    metadata: {},
    ...overrides,
  };
}

function createMovementCommand(
  input: MovementInput,
  idempotencyKey = randomUUID()
): CreateMovementCommand {
  return {
    ...commandBase(),
    type: "CreateMovementCommand",
    payload: {
      movement: input,
      idempotency_key: idempotencyKey,
    },
  };
}

describe("CommandDispatcher", () => {
  it("registra un gasto y descuenta la cuenta origen", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);

    const result = await dispatcher.dispatch(
      createMovementCommand(movementInput({ amount: 8 }))
    );

    expect(result.type).toBe("movement_created");
    expect(repository.accountBalances.get(accountA)).toBe(92);
    expect(repository.auditLogs).toHaveLength(1);
    expect(repository.auditLogs[0].action).toBe("created");
    expect(repository.outboxEvents).toHaveLength(1);
    expect(repository.outboxEvents[0].event_type).toBe("movement_created");
    expect(result.movement.affects_account_balance).toBe(true);
  });

  it("permite cuenta null sin tocar saldos financieros", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);

    const result = await dispatcher.dispatch(
      createMovementCommand(
        movementInput({ account_origin_id: null, amount: 8 })
      )
    );

    expect(repository.accountBalances.get(accountA)).toBe(100);
    expect(result.movement.account_origin_id).toBeNull();
    expect(result.movement.affects_account_balance).toBe(false);
    expect(result.movement.affects_total_balance).toBe(false);
  });

  it("registra pago recurrente sin cuenta sin tocar saldos", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);

    const result = await dispatcher.dispatch(
      createMovementCommand(
        movementInput({
          type: "pago_recurrente",
          amount: 35,
          source: "recurring_confirmed",
          account_origin_id: null,
          recurring_rule_id: "00000000-0000-4000-8000-0000000000ee",
          recurring_occurrence_id: "00000000-0000-4000-8000-0000000000ff",
        })
      )
    );

    expect(result.movement.type).toBe("pago_recurrente");
    expect(repository.accountBalances.get(accountA)).toBe(100);
    expect(result.movement.affects_account_balance).toBe(false);
    expect(result.movement.affects_total_balance).toBe(false);
  });

  it("registra pago recurrente con cuenta descontando saldo origen", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);

    const result = await dispatcher.dispatch(
      createMovementCommand(
        movementInput({
          type: "pago_recurrente",
          amount: 35,
          source: "recurring_confirmed",
          account_origin_id: accountA,
          recurring_rule_id: "00000000-0000-4000-8000-0000000000ee",
          recurring_occurrence_id: "00000000-0000-4000-8000-0000000000ff",
        })
      )
    );

    expect(result.movement.type).toBe("pago_recurrente");
    expect(repository.accountBalances.get(accountA)).toBe(65);
    expect(result.movement.affects_account_balance).toBe(true);
    expect(result.movement.affects_total_balance).toBe(true);
  });

  it("hace idempotente el registro de movimientos", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);
    const idempotencyKey = "manual-cafe-2026-06-06";
    const command = createMovementCommand(movementInput(), idempotencyKey);

    const first = await dispatcher.dispatch(command);
    const second = await dispatcher.dispatch({
      ...command,
      command_id: randomUUID(),
    });

    expect(first.type).toBe("movement_created");
    expect(second.type).toBe("movement_created");
    if (second.type === "movement_created") {
      expect(second.idempotent).toBe(true);
    }
    expect(repository.movements.size).toBe(1);
    expect(repository.auditLogs).toHaveLength(1);
    expect(repository.outboxEvents).toHaveLength(1);
    expect(repository.accountBalances.get(accountA)).toBe(92);
  });

  it("corrige monto y cuenta dejando auditoria y recalculando saldos", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100, [accountB]: 50 },
    });
    const dispatcher = new CommandDispatcher(repository);
    const created = await dispatcher.dispatch(
      createMovementCommand(movementInput({ amount: 8, account_origin_id: accountA }))
    );

    const result = await dispatcher.dispatch({
      ...commandBase(),
      type: "CorrectMovementCommand",
      payload: {
        movement_id: created.movement.id,
        corrected_fields: {
          amount: 10,
          account_origin_id: accountB,
          description: "Uber de trabajo",
          category_id: "transporte",
        },
        user_correction_text: "no era cafe, era Uber de trabajo",
        reason: "user_correction",
      },
    });

    expect(result.type).toBe("movement_corrected");
    expect(repository.accountBalances.get(accountA)).toBe(100);
    expect(repository.accountBalances.get(accountB)).toBe(40);
    expect(result.movement.status).toBe("corrected");
    expect(repository.auditLogs.some((log) => log.action === "corrected")).toBe(
      true
    );
    expect(repository.outboxEvents.some((event) => event.event_type === "movement_corrected")).toBe(
      true
    );
  });

  it("elimina logicamente un movimiento y revierte su efecto financiero", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);
    const created = await dispatcher.dispatch(
      createMovementCommand(movementInput({ amount: 8 }))
    );

    const result = await dispatcher.dispatch({
      ...commandBase(),
      type: "DeleteMovementCommand",
      payload: {
        movement_id: created.movement.id,
        mode: "soft_delete",
        reason: "registro duplicado",
      },
    });

    expect(result.type).toBe("movement_deleted");
    expect(result.movement.status).toBe("deleted");
    expect(result.movement.deleted_at).not.toBeNull();
    expect(repository.outboxEvents.some((event) => event.event_type === "movement_deleted")).toBe(
      true
    );
    expect(repository.accountBalances.get(accountA)).toBe(100);
  });

  it("restaura un soft delete, recompone el saldo y deja auditoria", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);
    const created = await dispatcher.dispatch(
      createMovementCommand(movementInput({ amount: 8 })),
    );
    await dispatcher.dispatch({
      ...commandBase(),
      type: "DeleteMovementCommand",
      payload: {
        movement_id: created.movement.id,
        mode: "soft_delete",
        reason: "lo borre por error",
      },
    });

    const restored = await dispatcher.dispatch({
      ...commandBase(),
      type: "RestoreMovementCommand",
      payload: {
        movement_id: created.movement.id,
        reason: "deshacer eliminacion",
      },
    });

    expect(restored.type).toBe("movement_restored");
    expect(restored.movement.status).toBe("confirmed");
    expect(restored.movement.deleted_at).toBeNull();
    expect(repository.accountBalances.get(accountA)).toBe(92);
    expect(repository.auditLogs.at(-1)?.action).toBe("restored");
    expect(repository.outboxEvents.at(-1)?.event_type).toBe(
      "movement_restored",
    );
  });

  it("no restaura una reversion financiera", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);
    const created = await dispatcher.dispatch(
      createMovementCommand(movementInput({ amount: 8 })),
    );
    await dispatcher.dispatch({
      ...commandBase(),
      type: "DeleteMovementCommand",
      payload: {
        movement_id: created.movement.id,
        mode: "reverse",
        reason: "operacion revertida",
      },
    });

    await expect(
      dispatcher.dispatch({
        ...commandBase(),
        type: "RestoreMovementCommand",
        payload: {
          movement_id: created.movement.id,
          reason: "intento invalido",
        },
      }),
    ).rejects.toMatchObject({
      code: "MOVEMENT_REVERSED_NOT_RESTORABLE",
    });
  });

  it("rechaza transferencia sin cuenta destino", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);

    await expect(
      dispatcher.dispatch(
        createMovementCommand(
          movementInput({
            type: "transferencia",
            account_origin_id: accountA,
            account_destination_id: null,
          })
        )
      )
    ).rejects.toMatchObject({
      code: "INVALID_MOVEMENT_ACCOUNTS",
    } satisfies Partial<CoreError>);
  });

  it("transfiere entre cuentas sin cambiar el total financiero", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100, [accountB]: 50 },
    });
    const dispatcher = new CommandDispatcher(repository);

    const result = await dispatcher.dispatch(
      createMovementCommand(
        movementInput({
          type: "transferencia",
          amount: 20,
          account_origin_id: accountA,
          account_destination_id: accountB,
          category_id: null,
          source_ref: "money-action:transfer_between_accounts:test-1",
        })
      )
    );

    expect(result.movement.type).toBe("transferencia");
    expect(result.movement.affects_total_balance).toBe(false);
    expect(result.movement.affects_account_balance).toBe(true);
    expect(repository.accountBalances.get(accountA)).toBe(80);
    expect(repository.accountBalances.get(accountB)).toBe(70);
  });

  it("mueve dinero entre cajas sin cambiar cuenta total", async () => {
    const boxB = "00000000-0000-4000-8000-0000000000dd";
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
      boxBalances: { [boxA]: 20, [boxB]: 5 },
    });
    const dispatcher = new CommandDispatcher(repository);

    const result = await dispatcher.dispatch(
      createMovementCommand(
        movementInput({
          type: "asignacion_interna",
          amount: 7,
          account_origin_id: null,
          box_origin_id: boxA,
          box_destination_id: boxB,
          category_id: null,
        })
      )
    );

    expect(result.movement.affects_total_balance).toBe(false);
    expect(repository.accountBalances.get(accountA)).toBe(100);
    expect(repository.boxBalances.get(boxA)).toBe(13);
    expect(repository.boxBalances.get(boxB)).toBe(12);
  });

  it("ajusta una cuenta con motivo y deja trazabilidad", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);

    const result = await dispatcher.dispatch(
      createMovementCommand(
        movementInput({
          type: "ajuste",
          amount: 25,
          account_origin_id: null,
          account_destination_id: accountA,
          category_id: null,
          metadata: { reason: "saldo declarado por usuario" },
        })
      )
    );

    expect(result.movement.type).toBe("ajuste");
    expect(result.movement.affects_total_balance).toBe(true);
    expect(repository.accountBalances.get(accountA)).toBe(125);
    expect(repository.auditLogs[0].new_value).toMatchObject({
      metadata: { reason: "saldo declarado por usuario" },
    });
  });

  it("rechaza ajustes sin metadata.reason", async () => {
    const repository = new InMemoryFinancialCoreRepository({
      accountBalances: { [accountA]: 100 },
    });
    const dispatcher = new CommandDispatcher(repository);

    await expect(
      dispatcher.dispatch(
        createMovementCommand(
          movementInput({
            type: "ajuste",
            amount: 10,
            account_origin_id: accountA,
            category_id: null,
            metadata: {},
          })
        )
      )
    ).rejects.toMatchObject({
      code: "INVALID_ADJUSTMENT",
    } satisfies Partial<CoreError>);
  });
});
