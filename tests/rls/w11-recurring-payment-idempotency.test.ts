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
  user = await crearUsuarioDePrueba("w11-recurring-payment-idempotency");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-11: idempotencia de pago recurrente en Core", () => {
  it("repite el mismo payload y rechaza reutilizar la llave con otro monto", async () => {
    const ruleId = randomUUID();
    const occurrenceId = randomUUID();
    const movementId = randomUUID();
    const idempotencyKey = `w11-recurring-payment-${randomUUID()}`;
    const paidAt = "2026-07-29T12:00:00-05:00";
    const idempotencyPayload = {
      recurring_rule_id: ruleId,
      recurring_occurrence_id: occurrenceId,
      amount: 100,
      currency: "PEN",
      account_id: null,
      paid_at: paidAt,
      note: "Internet julio",
    };

    expect(
      (
        await admin.from("recurring_rules").insert({
          id: ruleId,
          user_id: user.id,
          status: "active",
          name: "Internet idempotente",
          expected_amount: 100,
          amount_variability: "fixed",
          currency: "PEN",
          frequency: "monthly",
          next_expected_date: "2026-08-29",
          requires_confirmation_for_payment: true,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("recurring_occurrences").insert({
          id: occurrenceId,
          user_id: user.id,
          recurring_rule_id: ruleId,
          expected_date: "2026-07-29",
          expected_amount: 100,
          status: "expected",
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("movements").insert({
          id: movementId,
          user_id: user.id,
          type: "pago_recurrente",
          status: "confirmed",
          amount: 100,
          currency: "PEN",
          occurred_at: paidAt,
          description: "Internet julio",
          source: "recurring_confirmed",
          idempotency_key: idempotencyKey,
          recurring_rule_id: ruleId,
          recurring_occurrence_id: occurrenceId,
          affects_total_balance: false,
          affects_account_balance: false,
          metadata: { idempotency_payload: idempotencyPayload },
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin
          .from("recurring_occurrences")
          .update({
            status: "paid",
            paid_at: paidAt,
            paid_movement_id: movementId,
          })
          .eq("id", occurrenceId)
      ).error
    ).toBeNull();
    expect(
      (
        await admin
          .from("recurring_rules")
          .update({ status: "paused" })
          .eq("id", ruleId)
      ).error
    ).toBeNull();

    const replay = await callCommit({
      ruleId,
      occurrenceId,
      idempotencyKey,
      paidAt,
      amount: 100,
      idempotencyPayload,
    });
    expect(replay.error).toBeNull();
    expect(
      (replay.data as { idempotent?: boolean } | null)?.idempotent
    ).toBe(true);

    const conflict = await callCommit({
      ruleId,
      occurrenceId,
      idempotencyKey,
      paidAt,
      amount: 101,
      idempotencyPayload: { ...idempotencyPayload, amount: 101 },
    });
    expect(conflict.error).not.toBeNull();
    expect(conflict.error?.message ?? "").toContain(
      "RECURRING_PAYMENT_IDEMPOTENCY_CONFLICT"
    );
  });
});

function callCommit(params: {
  ruleId: string;
  occurrenceId: string;
  idempotencyKey: string;
  paidAt: string;
  amount: number;
  idempotencyPayload: Record<string, unknown>;
}) {
  return admin.rpc("commit_recurring_payment", {
    p_recurring_rule_id: params.ruleId,
    p_occurrence_id: params.occurrenceId,
    p_movement: {
      id: randomUUID(),
      user_id: user.id,
      type: "pago_recurrente",
      status: "confirmed",
      amount: params.amount,
      currency: "PEN",
      occurred_at: params.paidAt,
      description: "Internet julio",
      source: "recurring_confirmed",
      idempotency_key: params.idempotencyKey,
      account_origin_id: null,
      account_destination_id: null,
      box_origin_id: null,
      box_destination_id: null,
      debt_id: null,
      recurring_rule_id: params.ruleId,
      recurring_occurrence_id: params.occurrenceId,
      metadata: { idempotency_payload: params.idempotencyPayload },
    },
    p_audit_logs: [],
    p_account_deltas: [],
    p_box_deltas: [],
    p_movement_outbox_events: [],
    p_recurring_outbox_events: [],
  });
}
