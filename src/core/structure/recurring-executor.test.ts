import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { executeStructureCommand } from "./structure-executor";
import type { StructureCommand } from "./structure-commands";

const mocks = vi.hoisted(() => ({
  createRecurringRule: vi.fn(),
  updateRecurringRule: vi.fn(),
  cancelRecurringRule: vi.fn(),
  getRecurringRuleById: vi.fn(),
  getAccountById: vi.fn(),
  appendStructureAudit: vi.fn(),
  findRecurringRuleByStructureIdempotencyKey: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/data/repositories/recurring.repository", () => ({
  createRecurringRule: mocks.createRecurringRule,
  updateRecurringRule: mocks.updateRecurringRule,
  cancelRecurringRule: mocks.cancelRecurringRule,
  getRecurringRuleById: mocks.getRecurringRuleById,
}));

vi.mock("@/data/repositories/accounts.repository", () => ({
  getAccountById: mocks.getAccountById,
  createBox: vi.fn(),
  updateBoxMeta: vi.fn(),
  getBoxById: vi.fn(),
  getFreeBalanceForAccount: vi.fn(),
  softDeleteBox: vi.fn(),
  createAccount: vi.fn(),
  updateAccountMeta: vi.fn(),
  softDeleteAccount: vi.fn(),
  archiveBoxesForAccount: vi.fn(),
  getActiveAccounts: vi.fn(),
}));

vi.mock("@/data/repositories/structure.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/structure.repository")
  >("@/data/repositories/structure.repository");
  return {
    ...actual,
    appendStructureAudit: mocks.appendStructureAudit,
    findRecurringRuleByStructureIdempotencyKey:
      mocks.findRecurringRuleByStructureIdempotencyKey,
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
const RULE_ID = "00000000-0000-4000-8000-000000000031";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c3";
const COMMAND_ID = "00000000-0000-4000-8000-0000000000d3";
const IDEMPOTENCY_KEY = `structure:${PROPOSAL_ID}`;

function envelope(userId: string = USER_ID) {
  return {
    command_id: COMMAND_ID,
    user_id: userId,
    actor: { type: "user" as const, id: userId },
    source: "orchestrator.structure_confirm",
    trace_id: "trace-rec-1",
    idempotency_key: IDEMPOTENCY_KEY,
  };
}

function rule(overrides: Record<string, unknown> = {}) {
  return {
    id: RULE_ID,
    user_id: USER_ID,
    status: "active",
    name: "Netflix",
    expected_amount: 44.9,
    amount_variability: "fixed",
    currency: "PEN",
    frequency: "monthly",
    next_expected_date: "2026-09-05",
    category_id: null,
    default_account_id: null,
    metadata: {},
    occurrences: [],
    ...overrides,
  };
}

function createCommand(
  payload: Record<string, unknown> = {},
): StructureCommand {
  return {
    ...envelope(),
    type: "CreateRecurringCommand",
    payload: {
      name: "Netflix",
      expected_amount: 44.9,
      amount_variability: "fixed",
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-09-05",
      category_id: null,
      default_account_id: null,
      ...payload,
    },
  } as StructureCommand;
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.findRecurringRuleByStructureIdempotencyKey.mockResolvedValue(null);
  mocks.createRecurringRule.mockResolvedValue(rule());
  mocks.getRecurringRuleById.mockResolvedValue(rule());
  mocks.updateRecurringRule.mockResolvedValue(rule({ name: "Netflix Premium" }));
  mocks.cancelRecurringRule.mockResolvedValue(rule({ status: "cancelled" }));
  mocks.getAccountById.mockResolvedValue({
    id: ACCOUNT_ID,
    name: "BCP",
    currency: "PEN",
  });
  mocks.appendStructureAudit.mockResolvedValue(undefined);
});

describe("crear un pago recurrente conversando", () => {
  it("crea la regla, no mueve dinero y deja auditoría", async () => {
    const result = await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "applied",
      entity: "recurrente",
      operation: "create",
      entity_id: RULE_ID,
      idempotent: false,
    });

    // `RUL-REC-01`: una regla recurrente no toca saldos. El motor de
    // movimientos no se llama ni una vez.
    expect(mocks.dispatch).not.toHaveBeenCalled();

    expect(mocks.createRecurringRule).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        userId: USER_ID,
        idempotencyKey: IDEMPOTENCY_KEY,
        source: "conversational_structure",
      }),
    );
    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        entityType: "recurring_rule",
        entityId: RULE_ID,
        action: "created",
        idempotencyKey: IDEMPOTENCY_KEY,
      }),
    );
  });

  it("un doble envío con la misma clave no crea una segunda regla", async () => {
    mocks.findRecurringRuleByStructureIdempotencyKey.mockResolvedValue(rule());

    const result = await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.createRecurringRule).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });

  it("una cuenta en otra moneda no crea la regla", async () => {
    mocks.getAccountById.mockResolvedValue({
      id: ACCOUNT_ID,
      name: "Interbank USD",
      currency: "USD",
    });

    const result = await executeStructureCommand({
      client,
      command: createCommand({ default_account_id: ACCOUNT_ID }),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      error_code: "RECURRING_RULE_CURRENCY_MISMATCH",
    });
    expect(mocks.createRecurringRule).not.toHaveBeenCalled();
  });

  it("un nombre repetido se responde, no explota", async () => {
    mocks.createRecurringRule.mockRejectedValue(
      new Error("RECURRING_RULE_NAME_CONFLICT"),
    );

    const result = await executeStructureCommand({
      client,
      command: createCommand(),
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      reason: "conflict",
      error_code: "RECURRING_RULE_NAME_CONFLICT",
    });
  });
});

describe("modificar un pago recurrente", () => {
  it("no reescribe cuando lo pedido ya es lo que hay", async () => {
    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "UpdateRecurringCommand",
        payload: { recurring_rule_id: RULE_ID, expected_amount: 44.9 },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });

  it("dejar un pago fijo sin monto se rechaza antes de escribir", async () => {
    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "UpdateRecurringCommand",
        payload: { recurring_rule_id: RULE_ID, expected_amount: null },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      error_code: "RECURRING_RULE_FIXED_AMOUNT_REQUIRED",
    });
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("una regla que no es del usuario no se modifica", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(null);

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(OTHER_USER_ID),
        type: "UpdateRecurringCommand",
        payload: { recurring_rule_id: RULE_ID, name: "Otro" },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      error_code: "RECURRING_RULE_NOT_FOUND",
    });
    expect(mocks.getRecurringRuleById).toHaveBeenCalledWith(
      client,
      OTHER_USER_ID,
      RULE_ID,
    );
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });
});

describe("ciclo de vida de un pago recurrente", () => {
  it("pausar cambia el estado y lo anota como cambio, no como baja", async () => {
    mocks.updateRecurringRule.mockResolvedValue(rule({ status: "paused" }));

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "PauseRecurringCommand",
        payload: { recurring_rule_id: RULE_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", operation: "pause" });
    expect(mocks.updateRecurringRule).toHaveBeenCalledWith(
      client,
      USER_ID,
      RULE_ID,
      expect.objectContaining({ status: "paused" }),
    );
    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ action: "updated" }),
    );
  });

  it("pausar algo ya pausado no vuelve a escribir", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(rule({ status: "paused" }));

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "PauseRecurringCommand",
        payload: { recurring_rule_id: RULE_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.updateRecurringRule).not.toHaveBeenCalled();
  });

  it("reanudar algo que nunca se pausó se dice, no se fuerza", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(rule({ status: "suggested" }));

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "ResumeRecurringCommand",
        payload: { recurring_rule_id: RULE_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({
      kind: "failed",
      error_code: "RECURRING_RULE_NOT_PAUSED",
    });
  });

  it("cancelar deja rastro de baja y no mueve dinero", async () => {
    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "ArchiveRecurringCommand",
        payload: { recurring_rule_id: RULE_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", operation: "archive" });
    expect(mocks.cancelRecurringRule).toHaveBeenCalledWith(
      client,
      USER_ID,
      RULE_ID,
      "trace-rec-1",
    );
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        entityType: "recurring_rule",
        action: "deleted",
      }),
    );
  });

  it("cancelar dos veces no vuelve a cancelar", async () => {
    mocks.getRecurringRuleById.mockResolvedValue(rule({ status: "cancelled" }));

    const result = await executeStructureCommand({
      client,
      command: {
        ...envelope(),
        type: "ArchiveRecurringCommand",
        payload: { recurring_rule_id: RULE_ID },
      } as StructureCommand,
      movementSource: "dashboard_manual",
    });

    expect(result).toMatchObject({ kind: "applied", idempotent: true });
    expect(mocks.cancelRecurringRule).not.toHaveBeenCalled();
    expect(mocks.appendStructureAudit).not.toHaveBeenCalled();
  });
});
