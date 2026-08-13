import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { executeMoneyActionCommand } from "./money-action-executor";
import type { MoneyActionCommand } from "./money-action-proposal";

const mocks = vi.hoisted(() => ({
  getAccountById: vi.fn(),
  getBoxById: vi.fn(),
  getFreeBalanceForAccount: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
  getBoxById: mocks.getBoxById,
  getFreeBalanceForAccount: mocks.getFreeBalanceForAccount,
}));

vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: class {},
}));

vi.mock("@/core/finance", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/core/finance")>();
  return {
    ...actual,
    CommandDispatcher: class {
      dispatch = mocks.dispatch;
    },
  };
});

const client = {} as SupabaseClient<Database>;

const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const BCP_ID = "00000000-0000-4000-8000-000000000a01";
const YAPE_ID = "00000000-0000-4000-8000-000000000a02";
const BOX_VIAJE_ID = "00000000-0000-4000-8000-000000000b01";
const BOX_EMERGENCIA_ID = "00000000-0000-4000-8000-000000000b02";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const IDEMPOTENCY_KEY = `money_action:${PROPOSAL_ID}`;

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: BCP_ID,
    user_id: USER_ID,
    name: "BCP",
    currency: "PEN",
    current_balance: 500,
    ...overrides,
  };
}

function box(overrides: Record<string, unknown> = {}) {
  return {
    id: BOX_VIAJE_ID,
    user_id: USER_ID,
    account_id: BCP_ID,
    name: "Viaje",
    current_balance: 300,
    ...overrides,
  };
}

function movement(overrides: Record<string, unknown> = {}) {
  return {
    id: "movement-1",
    user_id: USER_ID,
    currency: "PEN",
    amount: 100,
    ...overrides,
  };
}

function transferCommand(overrides: Partial<MoneyActionCommand["payload"]> = {}): MoneyActionCommand {
  return {
    operation: "transfer",
    catalog_command: "transferir",
    idempotency_key: IDEMPOTENCY_KEY,
    payload: {
      from_account_id: BCP_ID,
      to_account_id: YAPE_ID,
      amount: 100,
      description: null,
      ...overrides,
    },
  };
}

function run(command: MoneyActionCommand, userId = USER_ID) {
  return executeMoneyActionCommand({
    client,
    userId,
    command,
    movementSource: "dashboard_manual",
    source: "orchestrator.money_action_confirm",
    traceId: "00000000-0000-4000-8000-0000000000e1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transferir", () => {
  it("escribe una transferencia y devuelve el resumen con los nombres reales", async () => {
    mocks.getAccountById.mockImplementation((_client: unknown, _userId: string, id: string) =>
      Promise.resolve(id === BCP_ID ? account() : account({ id: YAPE_ID, name: "Yape" })),
    );
    mocks.dispatch.mockResolvedValue({
      type: "movement_created",
      idempotent: false,
      movement: movement({ id: "mv-1" }),
    });

    const resultado = await run(transferCommand());

    expect(resultado.kind).toBe("applied");
    if (resultado.kind !== "applied") return;
    expect(resultado.entity_id).toBe("mv-1");
    expect(resultado.summary).toContain("BCP");
    expect(resultado.summary).toContain("Yape");
    expect(resultado.idempotent).toBe(false);

    const dispatched = mocks.dispatch.mock.calls[0][0];
    expect(dispatched.type).toBe("CreateMovementCommand");
    expect(dispatched.payload.idempotency_key).toBe(IDEMPOTENCY_KEY);
    expect(dispatched.payload.movement.type).toBe("transferencia");
    expect(dispatched.payload.movement.account_origin_id).toBe(BCP_ID);
    expect(dispatched.payload.movement.account_destination_id).toBe(YAPE_ID);
  });

  it("un doble envio del mismo boton se cuenta como ya hecho, no como fallo", async () => {
    mocks.getAccountById.mockImplementation((_client: unknown, _userId: string, id: string) =>
      Promise.resolve(id === BCP_ID ? account() : account({ id: YAPE_ID, name: "Yape" })),
    );
    mocks.dispatch
      .mockResolvedValueOnce({
        type: "movement_created",
        idempotent: false,
        movement: movement({ id: "mv-1" }),
      })
      .mockResolvedValueOnce({
        type: "movement_created",
        idempotent: true,
        movement: movement({ id: "mv-1" }),
      });

    const primera = await run(transferCommand());
    const segunda = await run(transferCommand());

    expect(primera.kind === "applied" && primera.idempotent).toBe(false);
    expect(segunda.kind === "applied" && segunda.idempotent).toBe(true);
  });

  it("cuentas de otro usuario no se encuentran y no se escribe", async () => {
    mocks.getAccountById.mockResolvedValue(null);

    const resultado = await run(transferCommand(), "otro-usuario");
    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.reason).toBe("conflict");
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.getAccountById).toHaveBeenCalledWith(client, "otro-usuario", BCP_ID);
  });

  it("monedas distintas no se transfieren", async () => {
    mocks.getAccountById.mockImplementation((_client: unknown, _userId: string, id: string) =>
      Promise.resolve(
        id === BCP_ID
          ? account({ currency: "PEN" })
          : account({ id: YAPE_ID, name: "Yape", currency: "USD" }),
      ),
    );

    const resultado = await run(transferCommand());
    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.detail).toContain("monedas distintas");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });
});

describe("separar_en_caja / devolver_a_libre / mover_entre_cajas", () => {
  it("separar_en_caja rechaza si el libre no alcanza (ERR-CUENTAS-03)", async () => {
    mocks.getBoxById.mockResolvedValue(box({ id: BOX_VIAJE_ID }));
    mocks.getAccountById.mockResolvedValue(account({ current_balance: 500 }));
    mocks.getFreeBalanceForAccount.mockResolvedValue(20);

    const resultado = await run({
      operation: "separate_to_box",
      catalog_command: "separar_en_caja",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        box_destination_id: BOX_VIAJE_ID,
        amount: 200,
        description: null,
      },
    });

    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.detail).toContain("Solo tienes S/20.00 libres");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("devolver_a_libre rechaza si se pide mas de lo que hay en la caja (ERR-CUENTAS-05)", async () => {
    mocks.getBoxById.mockResolvedValue(box({ current_balance: 50 }));
    mocks.getAccountById.mockResolvedValue(account());

    const resultado = await run({
      operation: "release_from_box",
      catalog_command: "devolver_a_libre",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        box_origin_id: BOX_VIAJE_ID,
        amount: 120,
        description: null,
      },
    });

    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.detail).toContain("tiene S/50.00");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("mover_entre_cajas de cuentas distintas sugiere transferir primero (ERR-CUENTAS-07)", async () => {
    mocks.getBoxById.mockImplementation((_client: unknown, _userId: string, id: string) =>
      Promise.resolve(
        id === BOX_VIAJE_ID
          ? box({ id: BOX_VIAJE_ID, account_id: BCP_ID })
          : box({ id: BOX_EMERGENCIA_ID, account_id: YAPE_ID, name: "Emergencia" }),
      ),
    );

    const resultado = await run({
      operation: "box_to_box",
      catalog_command: "mover_entre_cajas",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        box_origin_id: BOX_VIAJE_ID,
        box_destination_id: BOX_EMERGENCIA_ID,
        amount: 30,
        description: null,
      },
    });

    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.detail).toContain("Transfiere primero");
    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("mover_entre_cajas escribe la asignacion interna cuando las dos son de la misma cuenta", async () => {
    mocks.getBoxById.mockImplementation((_client: unknown, _userId: string, id: string) =>
      Promise.resolve(
        id === BOX_VIAJE_ID
          ? box({ id: BOX_VIAJE_ID, account_id: BCP_ID, current_balance: 300 })
          : box({
              id: BOX_EMERGENCIA_ID,
              account_id: BCP_ID,
              name: "Emergencia",
              current_balance: 100,
            }),
      ),
    );
    mocks.getAccountById.mockResolvedValue(account());
    mocks.dispatch.mockResolvedValue({
      type: "movement_created",
      idempotent: false,
      movement: movement({ id: "mv-2" }),
    });

    const resultado = await run({
      operation: "box_to_box",
      catalog_command: "mover_entre_cajas",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        box_origin_id: BOX_VIAJE_ID,
        box_destination_id: BOX_EMERGENCIA_ID,
        amount: 30,
        description: null,
      },
    });

    expect(resultado.kind).toBe("applied");
    if (resultado.kind !== "applied") return;
    expect(resultado.summary).toContain("Viaje");
    expect(resultado.summary).toContain("Emergencia");
    const dispatched = mocks.dispatch.mock.calls[0][0];
    expect(dispatched.payload.movement.type).toBe("asignacion_interna");
    expect(dispatched.payload.movement.box_origin_id).toBe(BOX_VIAJE_ID);
    expect(dispatched.payload.movement.box_destination_id).toBe(BOX_EMERGENCIA_ID);
  });
});
