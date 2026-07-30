import { beforeEach, describe, expect, it, vi } from "vitest";
import { CoreError } from "@/core/finance/errors";

const movementId = "11111111-1111-4111-8111-111111111111";
const userId = "22222222-2222-4222-8222-222222222222";
const recurringId = "33333333-3333-4333-8333-333333333333";
const occurrenceId = "44444444-4444-4444-8444-444444444444";
const debtId = "55555555-5555-4555-8555-555555555555";

const mocks = vi.hoisted(() => ({
  getApiAuth: vi.fn(),
  createServiceClient: vi.fn(),
  reverseDebtPayment: vi.fn(),
  reverseRecurringPayment: vi.fn(),
}));

vi.mock("@/app/api/_lib/auth", () => ({
  getApiAuth: mocks.getApiAuth,
}));

vi.mock("@/data/supabase/server", () => ({
  createServiceClient: mocks.createServiceClient,
}));

vi.mock("@/data/repositories/specialized-payment-reversal.repository", () => ({
  reverseDebtPayment: mocks.reverseDebtPayment,
  reverseRecurringPayment: mocks.reverseRecurringPayment,
}));

function ownedMovementClient(row: Record<string, unknown> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return { from: vi.fn().mockReturnValue(query) };
}

function request(body: unknown) {
  return new Request(`http://localhost/api/v1/movements/${movementId}`, {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function context(id = movementId) {
  return { params: Promise.resolve({ id }) };
}

describe("DELETE /api/v1/movements/[id] — reversión especializada W-11", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.createServiceClient.mockReturnValue({ role: "service" });
  });

  it("AC-REC-05: revierte un pago recurrente por su motor especializado", async () => {
    mocks.getApiAuth.mockResolvedValue({
      userId,
      client: ownedMovementClient({
        id: movementId,
        type: "pago_recurrente",
        status: "confirmed",
        debt_id: null,
        recurring_rule_id: recurringId,
        recurring_occurrence_id: occurrenceId,
      }),
    });
    mocks.reverseRecurringPayment.mockResolvedValue({
      movement: { id: movementId, status: "deleted" },
      recurring_rule: { id: recurringId },
      occurrence: { id: occurrenceId, status: "expected" },
      idempotent: false,
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      request({ mode: "soft_delete", reason: "Pago duplicado" }),
      context()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.type).toBe("movement_deleted");
    expect(payload.data.occurrence.status).toBe("expected");
    expect(mocks.reverseRecurringPayment).toHaveBeenCalledWith(
      { role: "service" },
      expect.objectContaining({
        userId,
        movementId,
        reason: "Pago duplicado",
      })
    );
  });

  it("AC-DEUDAS-09: revierte pago, deuda y asignaciones por Debt Engine", async () => {
    mocks.getApiAuth.mockResolvedValue({
      userId,
      client: ownedMovementClient({
        id: movementId,
        type: "pago_deuda",
        status: "confirmed",
        debt_id: debtId,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
      }),
    });
    mocks.reverseDebtPayment.mockResolvedValue({
      movement: { id: movementId, status: "deleted" },
      debt: { id: debtId, current_balance: 600 },
      payment: { id: "payment-1", reversed_at: "2026-07-29T12:00:00Z" },
      idempotent: false,
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      request({ mode: "soft_delete", reason: "Importe incorrecto" }),
      context()
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.debt.current_balance).toBe(600);
    expect(payload.data.payment.reversed_at).toBeTruthy();
  });

  it("una deuda condonada exige reabrir antes de revertir su pago", async () => {
    mocks.getApiAuth.mockResolvedValue({
      userId,
      client: ownedMovementClient({
        id: movementId,
        type: "pago_deuda",
        status: "confirmed",
        debt_id: debtId,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
      }),
    });
    mocks.reverseDebtPayment.mockRejectedValue(
      new CoreError(
        "DEBT_REVERSAL_CLOSED_DEBT_REOPEN_REQUIRED",
        "Reabre primero la deuda condonada antes de revertir este pago."
      )
    );
    const { DELETE } = await import("./route");

    const response = await DELETE(
      request({ mode: "soft_delete", reason: "Importe incorrecto" }),
      context()
    );
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe("CONFLICT");
  });

  it("sin sesión devuelve 401", async () => {
    mocks.getApiAuth.mockResolvedValue(null);
    const { DELETE } = await import("./route");

    const response = await DELETE(
      request({ mode: "soft_delete", reason: "Duplicado" }),
      context()
    );

    expect(response.status).toBe(401);
  });

  it("recurso de otro usuario devuelve 404, nunca 403", async () => {
    mocks.getApiAuth.mockResolvedValue({
      userId,
      client: ownedMovementClient(null),
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      request({ mode: "soft_delete", reason: "Duplicado" }),
      context()
    );
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe("NOT_FOUND");
  });

  it("validación devuelve 400 en español antes de escribir", async () => {
    mocks.getApiAuth.mockResolvedValue({
      userId,
      client: ownedMovementClient(null),
    });
    const { DELETE } = await import("./route");

    const response = await DELETE(
      request({ mode: "destruir", reason: "" }),
      context()
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(mocks.reverseRecurringPayment).not.toHaveBeenCalled();
  });

  it("idempotencia: repetir la misma reversión no duplica el efecto", async () => {
    const client = ownedMovementClient({
      id: movementId,
      type: "pago_recurrente",
      status: "deleted",
      debt_id: null,
      recurring_rule_id: recurringId,
      recurring_occurrence_id: occurrenceId,
    });
    mocks.getApiAuth.mockResolvedValue({ userId, client });
    mocks.reverseRecurringPayment.mockResolvedValue({
      movement: { id: movementId, status: "deleted" },
      recurring_rule: { id: recurringId },
      occurrence: { id: occurrenceId, status: "expected" },
      idempotent: true,
    });
    const { DELETE } = await import("./route");

    const first = await DELETE(
      request({ mode: "soft_delete", reason: "Duplicado" }),
      context()
    );
    const second = await DELETE(
      request({ mode: "soft_delete", reason: "Duplicado" }),
      context()
    );
    const secondPayload = await second.json();

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(secondPayload.meta.idempotent_replay).toBe(true);
    expect(secondPayload.data.movement.id).toBe(movementId);
  });
});
