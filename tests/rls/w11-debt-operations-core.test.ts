import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  admin,
  crearUsuarioDePrueba,
  limpiarUsuariosDePrueba,
  type UsuarioDePrueba,
} from "./lib/entorno";

let user: UsuarioDePrueba;

beforeAll(async () => {
  user = await crearUsuarioDePrueba("w11-debt-operations");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-11: operaciones especializadas de deuda", () => {
  it("no expone commit_debt_operation al rol authenticated", async () => {
    const result = await user.client.rpc("commit_debt_operation", {
      p_user_id: user.id,
      p_debt_id: randomUUID(),
      p_operation: "reopen",
      p_payload: {},
      p_idempotency_key: `blocked-${randomUUID()}`,
      p_trace_id: randomUUID(),
    });

    expect(result.data).toBeNull();
    expect(result.error).not.toBeNull();
  });

  it("condona, reintenta y reabre en transacciones idempotentes con outbox", async () => {
    const debtId = randomUUID();
    const closeKey = `close-${randomUUID()}`;
    const reopenKey = `reopen-${randomUUID()}`;
    await insertDebt(debtId);

    const first = await commitOperation({
      debtId,
      operation: "close",
      payload: { reason: "forgiven" },
      idempotencyKey: closeKey,
    });
    const retry = await commitOperation({
      debtId,
      operation: "close",
      payload: { reason: "forgiven" },
      idempotencyKey: closeKey,
    });
    const conflict = await commitOperation({
      debtId,
      operation: "close",
      payload: { reason: "paid" },
      idempotencyKey: closeKey,
    });

    expect(first.error).toBeNull();
    expect(first.data).toMatchObject({
      debt: {
        id: debtId,
        status: "cancelled",
        current_balance: 0,
        metadata: { forgiven_balance: 600 },
      },
      idempotent: false,
    });
    expect(retry.error).toBeNull();
    expect(retry.data).toMatchObject({ idempotent: true });
    expect(conflict.data).toBeNull();
    expect(conflict.error?.message).toContain(
      "DEBT_OPERATION_IDEMPOTENCY_CONFLICT"
    );

    const reopened = await commitOperation({
      debtId,
      operation: "reopen",
      payload: {},
      idempotencyKey: reopenKey,
    });
    expect(reopened.error).toBeNull();
    expect(reopened.data).toMatchObject({
      debt: {
        status: "active",
        current_balance: 600,
        closed_at: null,
      },
      idempotent: false,
    });

    const { count: receiptCount } = await admin
      .from("debt_operation_receipts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("debt_id", debtId);
    const { count: outboxCount } = await admin
      .from("transactional_outbox")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("payload->>debt_id", debtId)
      .in("event_type", ["debt_closed_forgiven", "debt_reopened"]);

    expect(receiptCount).toBe(2);
    expect(outboxCount).toBe(2);
  });

  it("reprograma y omite una cuota conservando historia, lock e idempotencia", async () => {
    const debtId = randomUUID();
    const installmentId = randomUUID();
    const rescheduleKey = `reschedule-${randomUUID()}`;
    const skipKey = `skip-${randomUUID()}`;
    await insertDebt(debtId);
    const { error: insertError } = await admin.from("debt_installments").insert({
      id: installmentId,
      user_id: user.id,
      debt_id: debtId,
      number: 1,
      due_date: "2026-08-15",
      expected_amount: 600,
      paid_amount: 0,
      status: "pending",
      metadata: {},
    });
    expect(insertError).toBeNull();

    const changed = await commitOperation({
      debtId,
      operation: "reschedule_installment",
      payload: {
        installment_id: installmentId,
        due_date: "2026-09-20",
        reason: "Nuevo acuerdo",
      },
      idempotencyKey: rescheduleKey,
    });
    const retry = await commitOperation({
      debtId,
      operation: "reschedule_installment",
      payload: {
        installment_id: installmentId,
        due_date: "2026-09-20",
        reason: "Nuevo acuerdo",
      },
      idempotencyKey: rescheduleKey,
    });

    expect(changed.error).toBeNull();
    expect(changed.data).toMatchObject({
      installment: {
        id: installmentId,
        due_date: "2026-09-20",
        status: "pending",
        expected_amount: 600,
        paid_amount: 0,
        metadata: {
          reschedule_history: [
            {
              from: "2026-08-15",
              to: "2026-09-20",
              reason: "Nuevo acuerdo",
            },
          ],
        },
      },
      idempotent: false,
    });
    expect(retry.data).toMatchObject({ idempotent: true });

    const skipped = await commitOperation({
      debtId,
      operation: "skip_installment",
      payload: {
        installment_id: installmentId,
        reason: "Incluida en otro acuerdo",
      },
      idempotencyKey: skipKey,
    });
    expect(skipped.error).toBeNull();
    expect(skipped.data).toMatchObject({
      debt: { next_payment_date: null },
      installment: {
        id: installmentId,
        status: "skipped",
        metadata: { skip_reason: "Incluida en otro acuerdo" },
      },
      idempotent: false,
    });
  });
});

async function insertDebt(debtId: string) {
  const { error } = await admin.from("debts").insert({
    id: debtId,
    user_id: user.id,
    direction: "i_owe",
    kind: "personal",
    status: "active",
    name: "Deuda W-11",
    principal_amount: 600,
    current_balance: 600,
    currency: "PEN",
    opened_at: "2026-07-29",
    source: "dashboard_manual",
    metadata: {},
  });
  expect(error).toBeNull();
}

function commitOperation(input: {
  debtId: string;
  operation: string;
  payload: Record<string, unknown>;
  idempotencyKey: string;
}) {
  return admin.rpc("commit_debt_operation", {
    p_user_id: user.id,
    p_debt_id: input.debtId,
    p_operation: input.operation,
    p_payload: input.payload,
    p_idempotency_key: input.idempotencyKey,
    p_trace_id: randomUUID(),
  });
}
