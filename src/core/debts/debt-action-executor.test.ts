import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { Debt, DebtInstallment } from "@/shared/types/domain";
import { executeDebtActionCommand } from "./debt-action-executor";
import type { DebtActionCommand } from "./debt-action-proposal";

const mocks = vi.hoisted(() => ({
  getDebtById: vi.fn(),
  getDebtInstallmentById: vi.fn(),
  closeDebt: vi.fn(),
  reopenDebt: vi.fn(),
  rescheduleDebtInstallment: vi.fn(),
  skipDebtInstallment: vi.fn(),
  appendStructureAudit: vi.fn(),
  dispatch: vi.fn(),
  getClassificationCatalog: vi.fn(),
}));

vi.mock("@/data/repositories/debts.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/debts.repository")
  >("@/data/repositories/debts.repository");
  return {
    DebtOperationError: actual.DebtOperationError,
    getDebtById: mocks.getDebtById,
    getDebtInstallmentById: mocks.getDebtInstallmentById,
    closeDebt: mocks.closeDebt,
    reopenDebt: mocks.reopenDebt,
    rescheduleDebtInstallment: mocks.rescheduleDebtInstallment,
    skipDebtInstallment: mocks.skipDebtInstallment,
  };
});

vi.mock("@/data/repositories/structure.repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/data/repositories/structure.repository")
  >("@/data/repositories/structure.repository");
  return {
    ...actual,
    appendStructureAudit: mocks.appendStructureAudit,
  };
});

vi.mock("@/data/repositories/classification.repository", () => ({
  getClassificationCatalog: mocks.getClassificationCatalog,
}));

vi.mock("@/core/classification", () => ({
  ClassificationCommandDispatcher: class {
    dispatch = mocks.dispatch;
  },
}));

const client = {} as SupabaseClient<Database>;

const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const OTRO_USER = "00000000-0000-4000-8000-0000000000f2";
const DEBT_ID = "00000000-0000-4000-8000-0000000000a1";
const INSTALLMENT_ID = "00000000-0000-4000-8000-0000000000b1";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const IDEMPOTENCY_KEY = `debt_action:${PROPOSAL_ID}`;

function debt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: DEBT_ID,
    user_id: USER_ID,
    direction: "i_owe",
    kind: "personal",
    status: "active",
    related_person_id: null,
    name: "Préstamo de Marco",
    principal_amount: 1000,
    current_balance: 600,
    currency: "PEN",
    opened_at: "2026-01-01",
    due_date: null,
    next_payment_date: null,
    installment_count: null,
    installment_amount: null,
    interest_notes: null,
    source: "app",
    confidence: null,
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    deleted_at: null,
    last_payment_at: null,
    closed_at: null,
    ...overrides,
  } as Debt;
}

function installment(overrides: Partial<DebtInstallment> = {}): DebtInstallment {
  return {
    id: INSTALLMENT_ID,
    user_id: USER_ID,
    debt_id: DEBT_ID,
    number: 1,
    due_date: "2026-09-01",
    expected_amount: 200,
    paid_amount: 0,
    status: "pending",
    metadata: {},
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  } as DebtInstallment;
}

function closeCommand(
  reason: "paid" | "forgiven",
  balance: number,
): DebtActionCommand {
  return {
    operation: "close",
    catalog_command: "cerrar_deuda",
    idempotency_key: IDEMPOTENCY_KEY,
    payload: { debt_id: DEBT_ID, reason, balance_at_proposal: balance },
  };
}

function run(command: DebtActionCommand, userId = USER_ID) {
  return executeDebtActionCommand({
    client,
    userId,
    command,
    source: "orchestrator.debt_action_confirm",
    traceId: "00000000-0000-4000-8000-0000000000e1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.appendStructureAudit.mockResolvedValue(undefined);
});

describe("cerrar_deuda: pagada y condonada escriben cosas distintas", () => {
  it("condonada nombra la cifra que quedo sin pagar", () => {
    mocks.getDebtById.mockResolvedValue(debt());
    mocks.closeDebt.mockResolvedValue({
      debt: debt({ status: "cancelled", current_balance: 0 }),
      idempotent: false,
    });

    return run(closeCommand("forgiven", 600)).then((resultado) => {
      expect(resultado.kind).toBe("applied");
      if (resultado.kind !== "applied") return;
      expect(resultado.summary).toContain("perdonada");
      expect(resultado.summary).toContain("S/600.00");
      expect(resultado.summary).toContain("sin pagar");
      expect(mocks.closeDebt).toHaveBeenCalledWith(
        client,
        expect.objectContaining({
          userId: USER_ID,
          reason: "forgiven",
          idempotencyKey: IDEMPOTENCY_KEY,
        }),
      );
    });
  });

  it("pagada no menciona ninguna cifra perdonada", async () => {
    mocks.getDebtById.mockResolvedValue(debt({ current_balance: 0 }));
    mocks.closeDebt.mockResolvedValue({
      debt: debt({ status: "paid", current_balance: 0 }),
      idempotent: false,
    });

    const resultado = await run(closeCommand("paid", 0));
    expect(resultado.kind).toBe("applied");
    if (resultado.kind !== "applied") return;
    expect(resultado.summary).toContain("pagada");
    expect(resultado.summary).not.toContain("perdonada");
  });

  it("si el saldo cambio entre la propuesta y el «si», NO cierra", async () => {
    // El caso real: se propuso condonar S/600, la persona pagó desde la pantalla
    // y volvio a decir "sí". Cerrarla ahora daria por perdonado un dinero que ya
    // se pagó, y ninguna de las dos etiquetas seria cierta (`RUL-DEUDAS-13`).
    mocks.getDebtById.mockResolvedValue(debt({ current_balance: 100 }));

    const resultado = await run(closeCommand("forgiven", 600));
    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.error_code).toBe("DEBT_ACTION_BALANCE_CHANGED");
    expect(resultado.detail).toContain("S/100.00");
    expect(mocks.closeDebt).not.toHaveBeenCalled();
  });

  it("un doble envio del mismo boton no cierra dos veces", async () => {
    mocks.getDebtById.mockResolvedValue(debt());
    mocks.closeDebt
      .mockResolvedValueOnce({
        debt: debt({ status: "cancelled" }),
        idempotent: false,
      })
      .mockResolvedValueOnce({
        debt: debt({ status: "cancelled" }),
        idempotent: true,
      });

    const primera = await run(closeCommand("forgiven", 600));
    const segunda = await run(closeCommand("forgiven", 600));

    expect(primera.kind === "applied" && primera.idempotent).toBe(false);
    expect(segunda.kind === "applied" && segunda.idempotent).toBe(true);
    // La clave es la misma en los dos envios: es lo que deja que el recibo de
    // `commit_debt_operation` responda en vez de repetir la escritura.
    const claves = mocks.closeDebt.mock.calls.map(
      (call) => call[1].idempotencyKey,
    );
    expect(claves).toEqual([IDEMPOTENCY_KEY, IDEMPOTENCY_KEY]);
  });

  it("una deuda de otro usuario no se encuentra y no se escribe", async () => {
    // `getDebtById` filtra por `user_id`; el cliente de servicio no salta esa
    // condicion porque el `userId` viaja explicito en cada llamada.
    mocks.getDebtById.mockResolvedValue(null);

    const resultado = await run(closeCommand("forgiven", 600), OTRO_USER);
    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.reason).toBe("reference_not_found");
    expect(mocks.closeDebt).not.toHaveBeenCalled();
    expect(mocks.getDebtById).toHaveBeenCalledWith(client, OTRO_USER, DEBT_ID);
  });

  it("un conflicto del RPC se cuenta con sus palabras y no como error de sistema", async () => {
    const { DebtOperationError } = await import(
      "@/data/repositories/debts.repository"
    );
    mocks.getDebtById.mockResolvedValue(debt());
    mocks.closeDebt.mockRejectedValue(
      new DebtOperationError(
        "DEBT_OPERATION_CONFLICT",
        "La deuda o cuota ya no admite esa operacion.",
      ),
    );

    const resultado = await run(closeCommand("forgiven", 600));
    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.reason).toBe("conflict");
    expect(resultado.detail).toContain("ya no admite");
  });
});

describe("cuotas", () => {
  it("saltar una cuota deja el motivo y no toca el saldo", async () => {
    mocks.getDebtById.mockResolvedValue(debt());
    mocks.getDebtInstallmentById.mockResolvedValue(installment());
    mocks.skipDebtInstallment.mockResolvedValue({
      installment: installment({ status: "skipped" }),
      idempotent: false,
    });

    const resultado = await run({
      operation: "skip_installment",
      catalog_command: "saltar_cuota",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        debt_id: DEBT_ID,
        installment_id: INSTALLMENT_ID,
        reason: "este mes no me alcanza",
      },
    });

    expect(resultado.kind).toBe("applied");
    expect(mocks.skipDebtInstallment).toHaveBeenCalledWith(
      client,
      expect.objectContaining({ reason: "este mes no me alcanza" }),
    );
  });

  it("una cuota que no es de esa deuda no se encuentra", async () => {
    mocks.getDebtById.mockResolvedValue(debt());
    mocks.getDebtInstallmentById.mockResolvedValue(null);

    const resultado = await run({
      operation: "reschedule_installment",
      catalog_command: "reprogramar_cuota",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        debt_id: DEBT_ID,
        installment_id: INSTALLMENT_ID,
        due_date: "2026-09-15",
        reason: null,
      },
    });

    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.error_code).toBe("DEBT_ACTION_INSTALLMENT_NOT_FOUND");
    expect(mocks.rescheduleDebtInstallment).not.toHaveBeenCalled();
  });
});

describe("crear_persona", () => {
  it("da de alta y deja auditoria", async () => {
    mocks.dispatch.mockResolvedValue({
      type: "related_person",
      entity: { id: "p-1", display_name: "Fabrizio" },
    });

    const resultado = await run({
      operation: "create_person",
      catalog_command: "crear_persona",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        display_name: "Fabrizio",
        kind: "person",
        relationship_label: "mi primo",
      },
    });

    expect(resultado.kind).toBe("applied");
    if (resultado.kind !== "applied") return;
    expect(resultado.idempotent).toBe(false);
    expect(mocks.appendStructureAudit).toHaveBeenCalledWith(
      client,
      expect.objectContaining({
        entityType: "related_person",
        action: "created",
        userId: USER_ID,
      }),
    );
  });

  it("un doble envio choca con el unico y se cuenta como ya hecho, no como fallo", async () => {
    // `ERR-DEUDAS-08`: el choque contra `(user_id, normalized_name)` es la
    // prueba de que la persona ya esta, no un error que contarle a nadie.
    mocks.dispatch.mockRejectedValue({ code: "23505" });
    mocks.getClassificationCatalog.mockResolvedValue({
      related_people: [{ id: "p-1", display_name: "Fabrizio" }],
    });

    const resultado = await run({
      operation: "create_person",
      catalog_command: "crear_persona",
      idempotency_key: IDEMPOTENCY_KEY,
      payload: {
        display_name: "Fabrizio",
        kind: "person",
        relationship_label: null,
      },
    });

    expect(resultado.kind).toBe("applied");
    if (resultado.kind !== "applied") return;
    expect(resultado.idempotent).toBe(true);
    expect(resultado.entity_id).toBe("p-1");
  });
});

describe("la auditoria no puede tumbar una escritura ya confirmada", () => {
  it("si el audit log falla, el cierre sigue contando como aplicado", async () => {
    mocks.getDebtById.mockResolvedValue(debt());
    mocks.closeDebt.mockResolvedValue({
      debt: debt({ status: "cancelled" }),
      idempotent: false,
    });
    mocks.appendStructureAudit.mockRejectedValue(new Error("audit caido"));

    const resultado = await run(closeCommand("forgiven", 600));
    expect(resultado.kind).toBe("applied");
  });
});
