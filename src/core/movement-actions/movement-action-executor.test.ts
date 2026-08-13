import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { executeMovementActionCommand } from "./movement-action-executor";
import type { MovementActionCommand } from "./movement-action-proposal";

const mocks = vi.hoisted(() => ({
  getMovementById: vi.fn(),
  dispatch: vi.fn(),
}));

vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: class {
    getMovementById = mocks.getMovementById;
  },
}));

vi.mock("@/core/finance", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/core/finance")>();
  return {
    ...actual,
    CommandDispatcher: class {
      dispatch = mocks.dispatch;
    },
  };
});

const client = {} as SupabaseClient<Database>;

const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const OTRO_USER = "00000000-0000-4000-8000-0000000000f2";
const MOVEMENT_ID = "00000000-0000-4000-8000-000000000d01";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";

function sourceMovement(overrides: Record<string, unknown> = {}) {
  return {
    id: MOVEMENT_ID,
    user_id: USER_ID,
    type: "gasto",
    status: "confirmed",
    amount: 40,
    currency: "PEN",
    occurred_at: "2026-08-11T18:00:00.000Z",
    description: "Súper",
    merchant: "Plaza Vea",
    category_id: "alimentacion",
    subcategory_id: null,
    account_origin_id: "acc-1",
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: "deuda-vieja",
    recurring_rule_id: "recurrente-vieja",
    recurring_occurrence_id: "ocurrencia-vieja",
    source: "whatsapp",
    source_ref: "wa:123",
    confidence: 0.9,
    requires_review: false,
    metadata: { delete_reason: "algo viejo" },
    ...overrides,
  };
}

function run(command: MovementActionCommand, userId = USER_ID) {
  return executeMovementActionCommand({
    client,
    userId,
    command,
    movementSource: "dashboard_manual",
    source: "orchestrator.movement_action_confirm",
    traceId: "00000000-0000-4000-8000-0000000000e1",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("restaurar_movimiento", () => {
  it("delega integro en RestoreMovementCommand", async () => {
    mocks.dispatch.mockResolvedValue({
      type: "movement_restored",
      movement: sourceMovement({ status: "confirmed", deleted_at: null }),
    });

    const resultado = await run({
      operation: "restore",
      catalog_command: "restaurar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: {
        movement_id: MOVEMENT_ID,
        reason: "Restaurado desde el asistente conversacional.",
      },
    });

    expect(resultado.kind).toBe("applied");
    if (resultado.kind !== "applied") return;
    expect(resultado.entity_id).toBe(MOVEMENT_ID);
    expect(resultado.summary).toContain("S/40.00");

    const dispatched = mocks.dispatch.mock.calls[0][0];
    expect(dispatched.type).toBe("RestoreMovementCommand");
    expect(dispatched.payload).toEqual({
      movement_id: MOVEMENT_ID,
      reason: "Restaurado desde el asistente conversacional.",
    });
  });

  it("un movimiento revertido no se restaura: el error del nucleo se cuenta con sus palabras", async () => {
    const { CoreError } = await import("@/core/finance/errors");
    mocks.dispatch.mockRejectedValue(
      new CoreError(
        "MOVEMENT_REVERSED_NOT_RESTORABLE",
        "Un movimiento revertido no puede restaurarse como si nunca hubiera ocurrido.",
      ),
    );

    const resultado = await run({
      operation: "restore",
      catalog_command: "restaurar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: { movement_id: MOVEMENT_ID, reason: "motivo" },
    });

    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.error_code).toBe("MOVEMENT_REVERSED_NOT_RESTORABLE");
    expect(resultado.detail).toContain("no puede restaurarse");
  });

  it("un movimiento que no esta eliminado no se restaura", async () => {
    const { CoreError } = await import("@/core/finance/errors");
    mocks.dispatch.mockRejectedValue(
      new CoreError("MOVEMENT_NOT_DELETED", "El movimiento no está eliminado."),
    );

    const resultado = await run({
      operation: "restore",
      catalog_command: "restaurar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: { movement_id: MOVEMENT_ID, reason: "motivo" },
    });

    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.error_code).toBe("MOVEMENT_NOT_DELETED");
  });
});

describe("duplicar_movimiento", () => {
  it("copia los campos relevantes pero no arrastra debt_id/recurring ni metadata vieja", async () => {
    mocks.getMovementById.mockResolvedValue(sourceMovement());
    mocks.dispatch.mockResolvedValue({
      type: "movement_created",
      idempotent: false,
      movement: sourceMovement({
        id: "mv-nuevo",
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
      }),
    });

    const resultado = await run({
      operation: "duplicate",
      catalog_command: "duplicar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: {
        source_movement_id: MOVEMENT_ID,
        occurred_at: null,
        amount: 40,
      },
    });

    expect(resultado.kind).toBe("applied");
    if (resultado.kind !== "applied") return;
    expect(resultado.entity_id).toBe("mv-nuevo");

    const dispatched = mocks.dispatch.mock.calls[0][0];
    expect(dispatched.type).toBe("CreateMovementCommand");
    const movementInput = dispatched.payload.movement;
    expect(movementInput.description).toBe("Súper");
    expect(movementInput.merchant).toBe("Plaza Vea");
    expect(movementInput.category_id).toBe("alimentacion");
    expect(movementInput.account_origin_id).toBe("acc-1");
    // El duplicado es independiente: no hereda vinculo especializado ni
    // metadata de auditoria del original.
    expect(movementInput.debt_id).toBeNull();
    expect(movementInput.recurring_rule_id).toBeNull();
    expect(movementInput.recurring_occurrence_id).toBeNull();
    expect(movementInput.metadata).not.toHaveProperty("delete_reason");
    expect(movementInput.metadata).toMatchObject({ duplicated_from: MOVEMENT_ID });
  });

  it("con override de fecha usa esa fecha; sin override usa ahora", async () => {
    mocks.getMovementById.mockResolvedValue(sourceMovement());
    mocks.dispatch.mockResolvedValue({
      type: "movement_created",
      idempotent: false,
      movement: sourceMovement({ id: "mv-nuevo" }),
    });

    await run({
      operation: "duplicate",
      catalog_command: "duplicar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: {
        source_movement_id: MOVEMENT_ID,
        occurred_at: "2026-08-15T00:00:00.000Z",
        amount: 40,
      },
    });

    const conFecha = mocks.dispatch.mock.calls[0][0].payload.movement;
    expect(conFecha.occurred_at).toBe("2026-08-15T00:00:00.000Z");

    mocks.dispatch.mockClear();
    await run({
      operation: "duplicate",
      catalog_command: "duplicar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: { source_movement_id: MOVEMENT_ID, occurred_at: null, amount: 40 },
    });
    const sinFecha = mocks.dispatch.mock.calls[0][0].payload.movement;
    expect(sinFecha.occurred_at).not.toBe("2026-08-15T00:00:00.000Z");
    expect(new Date(sinFecha.occurred_at).getTime()).not.toBeNaN();
  });

  it("un monto distinto al original se usa tal cual", async () => {
    mocks.getMovementById.mockResolvedValue(sourceMovement({ amount: 40 }));
    mocks.dispatch.mockResolvedValue({
      type: "movement_created",
      idempotent: false,
      movement: sourceMovement({ id: "mv-nuevo", amount: 60 }),
    });

    await run({
      operation: "duplicate",
      catalog_command: "duplicar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: { source_movement_id: MOVEMENT_ID, occurred_at: null, amount: 60 },
    });

    const movementInput = mocks.dispatch.mock.calls[0][0].payload.movement;
    expect(movementInput.amount).toBe(60);
  });

  it("un doble envio del mismo boton se cuenta como ya hecho, no como una segunda escritura", async () => {
    mocks.getMovementById.mockResolvedValue(sourceMovement());
    mocks.dispatch
      .mockResolvedValueOnce({
        type: "movement_created",
        idempotent: false,
        movement: sourceMovement({ id: "mv-nuevo" }),
      })
      .mockResolvedValueOnce({
        type: "movement_created",
        idempotent: true,
        movement: sourceMovement({ id: "mv-nuevo" }),
      });

    const command: MovementActionCommand = {
      operation: "duplicate",
      catalog_command: "duplicar_movimiento",
      idempotency_key: `movement_action:${PROPOSAL_ID}`,
      payload: { source_movement_id: MOVEMENT_ID, occurred_at: null, amount: 40 },
    };

    const primera = await run(command);
    const segunda = await run(command);
    expect(primera.kind === "applied" && primera.idempotent).toBe(false);
    expect(segunda.kind === "applied" && segunda.idempotent).toBe(true);
  });

  it("un movimiento de otro usuario no se encuentra y no se escribe", async () => {
    mocks.getMovementById.mockResolvedValue(null);

    const resultado = await run(
      {
        operation: "duplicate",
        catalog_command: "duplicar_movimiento",
        idempotency_key: `movement_action:${PROPOSAL_ID}`,
        payload: { source_movement_id: MOVEMENT_ID, occurred_at: null, amount: 40 },
      },
      OTRO_USER,
    );

    expect(resultado.kind).toBe("failed");
    if (resultado.kind !== "failed") return;
    expect(resultado.reason).toBe("reference_not_found");
    expect(mocks.dispatch).not.toHaveBeenCalled();
    expect(mocks.getMovementById).toHaveBeenCalledWith(OTRO_USER, MOVEMENT_ID);
  });
});
