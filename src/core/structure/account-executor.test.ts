import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { executeStructureCommand } from "./structure-executor";
import type { StructureCommand } from "./structure-commands";

const mocks = vi.hoisted(() => ({
  createAccount: vi.fn(),
  updateAccountMeta: vi.fn(),
  softDeleteAccount: vi.fn(),
  archiveBoxesForAccount: vi.fn(),
  getAccountById: vi.fn(),
  getActiveAccounts: vi.fn(),
  appendStructureAudit: vi.fn(),
  findAccountByStructureIdempotencyKey: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  createAccount: mocks.createAccount,
  updateAccountMeta: mocks.updateAccountMeta,
  softDeleteAccount: mocks.softDeleteAccount,
  archiveBoxesForAccount: mocks.archiveBoxesForAccount,
  getAccountById: mocks.getAccountById,
  getActiveAccounts: mocks.getActiveAccounts,
  createBox: vi.fn(),
  updateBoxMeta: vi.fn(),
  getBoxById: vi.fn(),
  getFreeBalanceForAccount: vi.fn(),
  softDeleteBox: vi.fn(),
}));

vi.mock("@/data/repositories/structure.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/structure.repository")
  >("@/data/repositories/structure.repository");
  return {
    ...actual,
    appendStructureAudit: mocks.appendStructureAudit,
    findAccountByStructureIdempotencyKey:
      mocks.findAccountByStructureIdempotencyKey,
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
const OTHER_USER_ID = "00000000-0000-4000-8000-0000000000f2";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000041";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c4";
const COMMAND_ID = "00000000-0000-4000-8000-0000000000d4";
const IDEMPOTENCY_KEY = `structure:${PROPOSAL_ID}`;

function envelope(userId: string = USER_ID) {
  return {
    command_id: COMMAND_ID,
    user_id: userId,
    actor: { type: "user" as const, id: userId },
    source: "orchestrator.structure_confirm",
    trace_id: "trace-cta-1",
    idempotency_key: IDEMPOTENCY_KEY,
  };
}

function account(overrides: Record<string, unknown> = {}) {
  return {
    id: ACCOUNT_ID,
    user_id: USER_ID,
    name: "BCP Ahorros",
    type: "banco",
    institution: "BCP",
    currency: "PEN",
    initial_balance: 1200,
    current_balance: 1200,
    is_default: false,
    metadata: {},
    deleted_at: null,
    ...overrides,
  };
}

function createCommand(payload: Record<string, unknown> = {}): StructureCommand {
  return {
    ...envelope(),
    type: "CreateAccountCommand",
    payload: {
      name: "BCP Ahorros",
      type: "banco",
      institution: "BCP",
      currency: "PEN",
      initial_balance: 1200,
      ...payload,
    },
  } as StructureCommand;
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findAccountByStructureIdempotencyKey.mockResolvedValue(null);
  mocks.getActiveAccounts.mockResolvedValue([account({ id: "otra" })]);
  mocks.createAccount.mockResolvedValue(account());
  mocks.getAccountById.mockResolvedValue(account());
  mocks.updateAccountMeta.mockResolvedValue(account({ name: "BCP Sueldo" }));
  mocks.archiveBoxesForAccount.mockResolvedValue([]);
  mocks.softDeleteAccount.mockResolvedValue(undefined);
  mocks.appendStructureAudit.mockResolvedValue(undefined);
});

describe("crear una cuenta conversando", () => {
  it("crea la cuenta con su saldo declarado, sin pasar por el motor de saldos", async () => {
    const result = await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity: "cuenta",
      operation: "create",
      entity_id: ACCOUNT_ID,
      idempotent: false,
    });

    // `RUL-CUENTAS-01`: el saldo inicial es una declaración del usuario, no un
    // movimiento. El motor de saldos no registra historia por esto.
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.createAccount).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        userId: USER_ID,
        initialBalance: 1200,
        metadata: expect.objectContaining({
          structure_idempotency_key: IDEMPOTENCY_KEY,
        }),
      }),
    );
    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ entityType: "account", action: "created" }),
    );
  });

  it("la primera cuenta del usuario queda como la de por defecto", async () => {
    mocks.getActiveAccounts.mockResolvedValue([]);

    await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(mocks.createAccount.mock.calls[0][1].isDefault).toBe(true);
  });

  it("con cuentas ya existentes no se roba la de por defecto", async () => {
    await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(mocks.createAccount.mock.calls[0][1].isDefault).toBe(false);
  });

  it("un doble envío con la misma clave no crea una segunda cuenta", async () => {
    mocks.findAccountByStructureIdempotencyKey.mockResolvedValue(account());

    const result = await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.createAccount).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
    expect(mocks.findAccountByStructureIdempotencyKey).toHaveBeenCalledWith(
      client,
      USER_ID,
      IDEMPOTENCY_KEY,
    );
  });

  it("un nombre repetido se responde, no explota", async () => {
    mocks.createAccount.mockRejectedValue({ code: "23505" });

    const result = await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      reason: "conflict",
      error_code: "ACCOUNT_NAME_TAKEN",
    });
  });
});

describe("modificar una cuenta", () => {
  it("no reescribe cuando lo pedido ya es lo que hay", async () => {
    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "UpdateAccountCommand",
        payload: { account_id: ACCOUNT_ID, name: "BCP Ahorros" },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.updateAccountMeta).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });

  it("una cuenta que no es del usuario no se modifica", async () => {
    mocks.getAccountById.mockResolvedValue(null);

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(OTHER_USER_ID),
        type: "UpdateAccountCommand",
        payload: { account_id: ACCOUNT_ID, name: "Mía ahora" },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      error_code: "ACCOUNT_NOT_FOUND",
    });
    expect(mocks.getAccountById).toHaveBeenCalledWith(
      client,
      OTHER_USER_ID,
      ACCOUNT_ID,
    );
    expect(mocks.updateAccountMeta).not.toHaveBeenCalled();
  });
});

describe("RUL-ESTR-05: archivar una cuenta arrastra sus cajas", () => {
  it("archiva las cajas en cascada, la cuenta, y lo deja anotado como baja", async () => {
    mocks.archiveBoxesForAccount.mockResolvedValue([
      { id: "caja-1" },
      { id: "caja-2" },
    ]);

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "ArchiveAccountCommand",
        payload: { account_id: ACCOUNT_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity: "cuenta",
      operation: "archive",
      entity_id: ACCOUNT_ID,
    });
    if (result.kind !== "applied") return;
    // El resumen nombra lo que se arrastró: dos cajas no pueden desaparecer en
    // silencio dentro de un "listo".
    expect(result.summary).toContain("2 cajas");

    expect(mocks.archiveBoxesForAccount).toHaveBeenCalledWith(
      client,
      USER_ID,
      ACCOUNT_ID,
    );
    expect(mocks.softDeleteAccount).toHaveBeenCalledWith(
      client,
      USER_ID,
      ACCOUNT_ID,
    );
    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ entityType: "account", action: "deleted" }),
    );
  });

  it("archivar una cuenta no mueve el dinero de sus cajas", async () => {
    await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "ArchiveAccountCommand",
        payload: { account_id: ACCOUNT_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(mocks.dispatch).not.toHaveBeenCalled();
  });

  it("una cuenta ajena o ya archivada no se toca", async () => {
    mocks.getAccountById.mockResolvedValue(null);

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(OTHER_USER_ID),
        type: "ArchiveAccountCommand",
        payload: { account_id: ACCOUNT_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      error_code: "ACCOUNT_NOT_FOUND",
    });
    expect(mocks.archiveBoxesForAccount).not.toHaveBeenCalled();
    expect(mocks.softDeleteAccount).not.toHaveBeenCalled();
  });
});
