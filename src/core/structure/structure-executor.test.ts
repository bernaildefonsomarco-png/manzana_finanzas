import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { executeStructureCommand } from "./structure-executor";
import type { StructureCommand } from "./structure-commands";

const mocks = vi.hoisted(() => ({
  createBox: vi.fn(),
  updateBoxMeta: vi.fn(),
  getAccountById: vi.fn(),
  getBoxById: vi.fn(),
  getFreeBalanceForAccount: vi.fn(),
  softDeleteBox: vi.fn(),
  commitBudgetOperationForUser: vi.fn(),
  commitGoalOperationForUser: vi.fn(),
  appendStructureAudit: vi.fn(),
  findBoxByStructureIdempotencyKey: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  createBox: mocks.createBox,
  updateBoxMeta: mocks.updateBoxMeta,
  getAccountById: mocks.getAccountById,
  getBoxById: mocks.getBoxById,
  getFreeBalanceForAccount: mocks.getFreeBalanceForAccount,
  softDeleteBox: mocks.softDeleteBox,
}));

vi.mock("@/data/repositories/budgets.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/budgets.repository")
  >("@/data/repositories/budgets.repository");
  return {
    BudgetOperationError: actual.BudgetOperationError,
    commitBudgetOperationForUser: mocks.commitBudgetOperationForUser,
    commitGoalOperationForUser: mocks.commitGoalOperationForUser,
  };
});

vi.mock("@/data/repositories/structure.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/structure.repository")
  >("@/data/repositories/structure.repository");
  return {
    ...actual,
    appendStructureAudit: mocks.appendStructureAudit,
    findBoxByStructureIdempotencyKey: mocks.findBoxByStructureIdempotencyKey,
  };
});

vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: class {},
}));

vi.mock("@/core/finance", () => ({
  CommandDispatcher: class {
    dispatch = mocks.dispatch;
  },
}));

const client = {} as SupabaseClient<Database>;

const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const BOX_ID = "00000000-0000-4000-8000-000000000002";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const COMMAND_ID = "00000000-0000-4000-8000-0000000000d1";

const IDEMPOTENCY_KEY = `structure:${PROPOSAL_ID}`;

function envelope() {
  return {
    command_id: COMMAND_ID,
    user_id: USER_ID,
    actor: { type: "user" as const, id: USER_ID },
    source: "orchestrator.structure_confirm",
    trace_id: "trace-1",
    idempotency_key: IDEMPOTENCY_KEY,
  };
}

function createBoxCommand(
  payload: Partial<
    Extract<StructureCommand, { type: "CreateBoxCommand" }>["payload"]
  > = {},
): StructureCommand {
  return {
    ...envelope(),
    type: "CreateBoxCommand",
    payload: {
      name: "Viaje",
      account_id: ACCOUNT_ID,
      type: "objetivo",
      initial_balance: 500,
      target_amount: null,
      target_date: null,
      ...payload,
    },
  };
}

function box(overrides: Record<string, unknown> = {}) {
  return {
    id: BOX_ID,
    user_id: USER_ID,
    account_id: ACCOUNT_ID,
    name: "Viaje",
    type: "objetivo",
    current_balance: 0,
    target_amount: null,
    target_date: null,
    linked_debt_id: null,
    linked_recurring_id: null,
    created_at: "2026-08-09T10:00:00.000Z",
    updated_at: "2026-08-09T10:00:00.000Z",
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findBoxByStructureIdempotencyKey.mockResolvedValue(null);
  mocks.getAccountById.mockResolvedValue({
    id: ACCOUNT_ID,
    name: "BCP",
    currency: "PEN",
  });
  mocks.getFreeBalanceForAccount.mockResolvedValue(1200);
  mocks.createBox.mockResolvedValue(box());
  mocks.getBoxById.mockResolvedValue(box({ current_balance: 500 }));
  mocks.dispatch.mockResolvedValue({ type: "movement_created" });
  mocks.appendStructureAudit.mockResolvedValue(undefined);
});

describe("crear una caja conversando", () => {
  it("crea la caja, aparta el dinero por el motor de saldos y deja auditoría", async () => {
    const result = await executeStructureCommand({
      client,
      command: createBoxCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity: "caja",
      operation: "create",
      entity_id: BOX_ID,
      idempotent: false,
    });

    // El dinero pasa por CommandDispatcher, no por una escritura directa.
    expect(mocks.dispatch).toHaveBeenCalledTimes(1);
    const [movementCommand] = mocks.dispatch.mock.calls[0];
    expect(movementCommand).toMatchObject({
      type: "CreateMovementCommand",
      user_id: USER_ID,
      payload: {
        idempotency_key: `box-initial-allocation:${BOX_ID}`,
        movement: {
          type: "asignacion_interna",
          amount: 500,
          box_destination_id: BOX_ID,
          source: "dashboard_manual",
        },
      },
    });

    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        userId: USER_ID,
        entityType: "box",
        entityId: BOX_ID,
        action: "created",
        actorType: "user",
        source: "orchestrator.structure_confirm",
        traceId: "trace-1",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    );
  });

  it("un doble envío con la misma clave no crea una segunda caja", async () => {
    mocks.findBoxByStructureIdempotencyKey.mockResolvedValue(
      box({ current_balance: 500 }),
    );

    const result = await executeStructureCommand({
      client,
      command: createBoxCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.createBox).not.toHaveBeenCalled();
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
    expect(mocks.findBoxByStructureIdempotencyKey).toHaveBeenCalledWith(
      client,
      USER_ID,
      IDEMPOTENCY_KEY,
    );
  });

  it("no aparta más de lo libre en la cuenta (RUL-CUENTAS-06)", async () => {
    mocks.getFreeBalanceForAccount.mockResolvedValue(120);

    const result = await executeStructureCommand({
      client,
      command: createBoxCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      reason: "insufficient_free_balance",
      detail: "Solo tienes S/120.00 libres en BCP.",
    });
    expect(mocks.createBox).not.toHaveBeenCalled();
  });

  it("si el movimiento falla, la caja a medias se deshace", async () => {
    mocks.dispatch.mockRejectedValue(new Error("core caido"));
    mocks.softDeleteBox.mockResolvedValue(undefined);

    const result = await executeStructureCommand({
      client,
      command: createBoxCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result.kind).toBe("failed");
    expect(mocks.softDeleteBox).toHaveBeenCalledWith(client, USER_ID, BOX_ID);
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });

  it("una caja sin dinero apartado no mueve saldo", async () => {
    mocks.createBox.mockResolvedValue(box({ current_balance: 0 }));

    const result = await executeStructureCommand({
      client,
      command: createBoxCommand({ initial_balance: 0 }),
      movementSource: "dashboard_manual",
    });

    expect(result.kind).toBe("applied");
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.getFreeBalanceForAccount).not.toHaveBeenCalled();
  });

  it("un nombre repetido en la misma cuenta se responde, no explota", async () => {
    mocks.createBox.mockRejectedValue({ code: "23505" });

    const result = await executeStructureCommand({
      client,
      command: createBoxCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      reason: "conflict",
      error_code: "BOX_NAME_TAKEN",
    });
  });

  it("una cuenta que no es del usuario no crea nada", async () => {
    mocks.getAccountById.mockResolvedValue(null);

    const result = await executeStructureCommand({
      client,
      command: createBoxCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      reason: "reference_not_found",
      error_code: "ACCOUNT_NOT_FOUND",
    });
    expect(mocks.createBox).not.toHaveBeenCalled();
  });
});

describe("modificar una caja conversando", () => {
  it("no reescribe cuando lo pedido ya es lo que hay", async () => {
    mocks.getBoxById.mockResolvedValue(box({ name: "Viaje a Cusco" }));

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "UpdateBoxCommand",
        payload: { box_id: BOX_ID, name: "Viaje a Cusco" },
      },
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.updateBoxMeta).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });

  it("una caja que no es del usuario no se modifica", async () => {
    mocks.getBoxById.mockResolvedValue(null);

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "UpdateBoxCommand",
        payload: { box_id: BOX_ID, name: "Otro nombre" },
      },
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      error_code: "BOX_NOT_FOUND",
    });
    expect(mocks.updateBoxMeta).not.toHaveBeenCalled();
  });
});

describe("presupuestos y metas van por su propio ejecutor transaccional", () => {
  it("un presupuesto se crea por el RPC con el user_id explícito", async () => {
    mocks.commitBudgetOperationForUser.mockResolvedValue({
      budget: {
        id: "00000000-0000-4000-8000-000000000010",
        amount: 500,
        period_kind: "mensual",
      },
      idempotent: false,
    });

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "CreateBudgetCommand",
        payload: {
          amount: 500,
          category_id: "alimentacion",
          period_kind: "mensual",
          kind: "presupuesto",
          rollover: false,
          auto_renew: true,
        },
      },
      movementSource: "dashboard_manual",
    });

    expect(mocks.commitBudgetOperationForUser).toHaveBeenCalledWith(client, {
      userId: USER_ID,
      operation: "create",
      budgetId: null,
      payload: expect.objectContaining({
        amount: 500,
        category_id: "alimentacion",
        source: "manual",
      }),
      idempotencyKey: IDEMPOTENCY_KEY,
      traceId: "trace-1",
    });
    // `RUL-PRES-01`: se nombra como referencia, no como dinero apartado.
    expect(result).toMatchObject({
      kind: "applied",
      entity: "presupuesto",
      summary: "un presupuesto de S/500.00 al mes",
    });
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("un replay idempotente del RPC no duplica la auditoría", async () => {
    mocks.commitBudgetOperationForUser.mockResolvedValue({
      budget: {
        id: "00000000-0000-4000-8000-000000000010",
        amount: 500,
        period_kind: "mensual",
      },
      idempotent: true,
    });

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "CreateBudgetCommand",
        payload: {
          amount: 500,
          category_id: "alimentacion",
          period_kind: "mensual",
          kind: "presupuesto",
          rollover: false,
          auto_renew: true,
        },
      },
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });

  it("una meta se crea por su propio RPC y deja auditoría", async () => {
    mocks.commitGoalOperationForUser.mockResolvedValue({
      goal: {
        id: "00000000-0000-4000-8000-000000000020",
        name: "Viaje",
        target_amount: 3000,
      },
      idempotent: false,
    });

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "CreateGoalCommand",
        payload: {
          name: "Viaje",
          target_amount: 3000,
          target_date: null,
          box_id: null,
        },
      },
      movementSource: "dashboard_manual",
    });

    expect(mocks.commitGoalOperationForUser).toHaveBeenCalledWith(client, {
      userId: USER_ID,
      operation: "create",
      goalId: null,
      payload: expect.objectContaining({ name: "Viaje", target_amount: 3000 }),
      idempotencyKey: IDEMPOTENCY_KEY,
      traceId: "trace-1",
    });
    expect(result).toMatchObject({ kind: "applied", entity: "meta" });
    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ entityType: "goal", action: "created" }),
    );
  });
});

describe("aislamiento por usuario", () => {
  it("toda escritura lleva el user_id del comando, nunca uno inferido", async () => {
    mocks.commitGoalOperationForUser.mockResolvedValue({
      goal: { id: "g1", name: "Viaje", target_amount: 3000 },
      idempotent: false,
    });

    await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "CreateGoalCommand",
        payload: {
          name: "Viaje",
          target_amount: 3000,
          target_date: null,
          box_id: null,
        },
      },
      movementSource: "dashboard_manual",
    });

    expect(mocks.commitGoalOperationForUser.mock.calls[0][1].userId).toBe(
      USER_ID,
    );
    expect(
      mocks.appendStructureAudit.mock.calls[0][1].userId,
    ).toBe(USER_ID);
  });

  it("un comando con envoltorio inválido no llega a ninguna escritura", async () => {
    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        user_id: "no-es-un-uuid",
        type: "CreateBoxCommand",
        payload: {
          name: "Viaje",
          account_id: ACCOUNT_ID,
          type: "objetivo",
          initial_balance: 0,
          target_amount: null,
          target_date: null,
        },
      } as unknown as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      reason: "invalid_command",
      error_code: "STRUCTURE_COMMAND_INVALID",
    });
    expect(mocks.createBox).not.toHaveBeenCalled();
    expect(mocks.commitGoalOperationForUser).not.toHaveBeenCalled();
  });
});
