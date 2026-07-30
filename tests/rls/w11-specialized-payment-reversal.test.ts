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
  user = await crearUsuarioDePrueba("w11-reversal");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-11: invariantes de recurrentes y reversión especializada", () => {
  it("AC-REC-13: la base rechaza una regla que desactive confirmación", async () => {
    const { error } = await admin.from("recurring_rules").insert({
      user_id: user.id,
      name: "Regla insegura",
      expected_amount: 10,
      currency: "PEN",
      frequency: "monthly",
      amount_variability: "fixed",
      requires_confirmation_for_payment: false,
    });

    expect(error).not.toBeNull();
    expect(error?.message ?? "").toContain(
      "recurring_rules_payment_requires_confirmation"
    );
  });

  it("RLS: un cliente autenticado no puede ejecutar el RPC financiero", async () => {
    const { error } = await user.client.rpc("reverse_debt_payment", {
      p_user_id: user.id,
      p_movement_id: randomUUID(),
      p_reason: "No autorizado",
      p_mode: "soft_delete",
      p_trace_id: randomUUID(),
    });

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase() ?? "").toContain("permission denied");
  });

  it("AC-DEUDAS-09: recompone movimiento, cuenta, pago, cuotas y deuda en Postgres real", async () => {
    const accountId = randomUUID();
    const debtId = randomUUID();
    const installmentId = randomUUID();
    const skippedInstallmentId = randomUUID();
    const movementId = randomUUID();
    const paymentId = randomUUID();

    expect(
      (
        await admin.from("accounts").insert({
          id: accountId,
          user_id: user.id,
          name: `Cuenta reversión ${Date.now()}`,
          type: "banco",
          currency: "PEN",
          current_balance: 900,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("debts").insert({
          id: debtId,
          user_id: user.id,
          direction: "i_owe",
          kind: "personal",
          status: "active",
          name: "Deuda para reversión",
          principal_amount: 1000,
          current_balance: 900,
          currency: "PEN",
          opened_at: "2026-07-01",
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("movements").insert({
          id: movementId,
          user_id: user.id,
          type: "pago_deuda",
          status: "confirmed",
          amount: 100,
          currency: "PEN",
          occurred_at: "2026-07-29T12:00:00-05:00",
          source: "dashboard_manual",
          idempotency_key: `w11-reversal-${randomUUID()}`,
          account_origin_id: accountId,
          debt_id: debtId,
          affects_total_balance: true,
          affects_account_balance: true,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("debt_installments").insert({
          id: installmentId,
          user_id: user.id,
          debt_id: debtId,
          number: 1,
          due_date: "2026-08-01",
          expected_amount: 100,
          paid_amount: 100,
          status: "paid",
          movement_id: movementId,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("debt_installments").insert({
          id: skippedInstallmentId,
          user_id: user.id,
          debt_id: debtId,
          number: 2,
          due_date: "2026-09-01",
          expected_amount: 900,
          paid_amount: 0,
          status: "skipped",
          metadata: { skip_reason: "Acuerdo previo" },
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("debt_payments").insert({
          id: paymentId,
          user_id: user.id,
          debt_id: debtId,
          movement_id: movementId,
          amount: 100,
          currency: "PEN",
          paid_at: "2026-07-29T12:00:00-05:00",
          source: "dashboard_manual",
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("debt_payment_allocations").insert({
          user_id: user.id,
          debt_id: debtId,
          debt_payment_id: paymentId,
          debt_installment_id: installmentId,
          movement_id: movementId,
          allocated_amount: 100,
          allocation_order: 1,
          policy: "oldest_open_due_date_first_v1",
        })
      ).error
    ).toBeNull();

    const traceId = randomUUID();
    const first = await admin.rpc("reverse_debt_payment", {
      p_user_id: user.id,
      p_movement_id: movementId,
      p_reason: "Pago duplicado",
      p_mode: "soft_delete",
      p_trace_id: traceId,
    });
    expect(first.error).toBeNull();
    expect(
      (first.data as { idempotent: boolean } | null)?.idempotent
    ).toBe(false);

    const [
      movement,
      account,
      debt,
      payment,
      allocation,
      installment,
      skippedInstallment,
    ] =
      await Promise.all([
        admin.from("movements").select("status,deleted_at").eq("id", movementId).single(),
        admin.from("accounts").select("current_balance").eq("id", accountId).single(),
        admin.from("debts").select("current_balance,status").eq("id", debtId).single(),
        admin.from("debt_payments").select("reversed_at").eq("id", paymentId).single(),
        admin
          .from("debt_payment_allocations")
          .select("reversed_at")
          .eq("debt_payment_id", paymentId)
          .single(),
        admin
          .from("debt_installments")
          .select("paid_amount,status,movement_id")
          .eq("id", installmentId)
          .single(),
        admin
          .from("debt_installments")
          .select("paid_amount,status,movement_id")
          .eq("id", skippedInstallmentId)
          .single(),
      ]);

    expect(movement.data).toMatchObject({ status: "deleted" });
    expect(movement.data?.deleted_at).toBeTruthy();
    expect(Number(account.data?.current_balance)).toBe(1000);
    expect(debt.data).toMatchObject({ current_balance: 1000, status: "active" });
    expect(payment.data?.reversed_at).toBeTruthy();
    expect(allocation.data?.reversed_at).toBeTruthy();
    expect(installment.data).toMatchObject({
      paid_amount: 0,
      status: "pending",
      movement_id: null,
    });
    expect(skippedInstallment.data).toMatchObject({
      paid_amount: 0,
      status: "skipped",
      movement_id: null,
    });

    const replay = await admin.rpc("reverse_debt_payment", {
      p_user_id: user.id,
      p_movement_id: movementId,
      p_reason: "Pago duplicado",
      p_mode: "soft_delete",
      p_trace_id: traceId,
    });
    expect(replay.error).toBeNull();
    expect(
      (replay.data as { idempotent: boolean } | null)?.idempotent
    ).toBe(true);

    const accountAfterReplay = await admin
      .from("accounts")
      .select("current_balance")
      .eq("id", accountId)
      .single();
    expect(Number(accountAfterReplay.data?.current_balance)).toBe(1000);
  });

  it("bloquea revertir un pago mientras la deuda siga condonada", async () => {
    const debtId = randomUUID();
    const movementId = randomUUID();
    const paymentId = randomUUID();

    expect(
      (
        await admin.from("debts").insert({
          id: debtId,
          user_id: user.id,
          direction: "i_owe",
          kind: "personal",
          status: "active",
          name: "Deuda condonada con pago previo",
          principal_amount: 1000,
          current_balance: 900,
          currency: "PEN",
          opened_at: "2026-07-01",
          source: "dashboard_manual",
          metadata: {},
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("movements").insert({
          id: movementId,
          user_id: user.id,
          type: "pago_deuda",
          status: "confirmed",
          amount: 100,
          currency: "PEN",
          occurred_at: "2026-07-20T12:00:00-05:00",
          source: "dashboard_manual",
          idempotency_key: `w11-forgiven-reversal-${randomUUID()}`,
          debt_id: debtId,
          affects_total_balance: false,
          affects_account_balance: false,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("debt_payments").insert({
          id: paymentId,
          user_id: user.id,
          debt_id: debtId,
          movement_id: movementId,
          amount: 100,
          currency: "PEN",
          paid_at: "2026-07-20T12:00:00-05:00",
          source: "dashboard_manual",
        })
      ).error
    ).toBeNull();

    const close = await admin.rpc("commit_debt_operation", {
      p_user_id: user.id,
      p_debt_id: debtId,
      p_operation: "close",
      p_payload: { reason: "forgiven" },
      p_idempotency_key: `w11-forgiven-${randomUUID()}`,
      p_trace_id: randomUUID(),
    });
    expect(close.error).toBeNull();

    const reversal = await admin.rpc("reverse_debt_payment", {
      p_user_id: user.id,
      p_movement_id: movementId,
      p_reason: "Pago duplicado",
      p_mode: "soft_delete",
      p_trace_id: randomUUID(),
    });
    expect(reversal.error).not.toBeNull();
    expect(reversal.error?.message ?? "").toContain(
      "DEBT_REVERSAL_CLOSED_DEBT_REOPEN_REQUIRED"
    );

    const [debt, movement, payment] = await Promise.all([
      admin.from("debts").select("status,current_balance").eq("id", debtId).single(),
      admin.from("movements").select("status").eq("id", movementId).single(),
      admin.from("debt_payments").select("reversed_at").eq("id", paymentId).single(),
    ]);
    expect(debt.data).toMatchObject({ status: "cancelled", current_balance: 0 });
    expect(movement.data?.status).toBe("confirmed");
    expect(payment.data?.reversed_at).toBeNull();
  });

  it("AC-REC-05: recompone movimiento, cuenta, ocurrencia y regla en Postgres real", async () => {
    const accountId = randomUUID();
    const ruleId = randomUUID();
    const occurrenceId = randomUUID();
    const movementId = randomUUID();

    expect(
      (
        await admin.from("accounts").insert({
          id: accountId,
          user_id: user.id,
          name: `Cuenta recurrente ${Date.now()}`,
          type: "banco",
          currency: "PEN",
          current_balance: 900,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("recurring_rules").insert({
          id: ruleId,
          user_id: user.id,
          status: "active",
          name: "Internet",
          expected_amount: 100,
          amount_variability: "fixed",
          currency: "PEN",
          frequency: "monthly",
          next_expected_date: "2026-08-29",
          last_paid_at: "2026-07-29T12:00:00-05:00",
          last_paid_amount: 100,
          requires_confirmation_for_payment: true,
        })
      ).error
    ).toBeNull();
    // The occurrence exists as expected before Core attaches its payment
    // movement; this is the same FK order used by the real commit.
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
          occurred_at: "2026-07-29T12:00:00-05:00",
          source: "recurring_confirmed",
          idempotency_key: `w11-rec-reversal-${randomUUID()}`,
          account_origin_id: accountId,
          recurring_rule_id: ruleId,
          recurring_occurrence_id: occurrenceId,
          affects_total_balance: true,
          affects_account_balance: true,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin
          .from("recurring_occurrences")
          .update({
            status: "paid",
            paid_at: "2026-07-29T12:00:00-05:00",
            paid_movement_id: movementId,
            metadata: { last_paid_amount: 100 },
          })
          .eq("id", occurrenceId)
      ).error
    ).toBeNull();

    const traceId = randomUUID();
    const first = await admin.rpc("reverse_recurring_payment", {
      p_user_id: user.id,
      p_movement_id: movementId,
      p_reason: "Pago duplicado",
      p_mode: "soft_delete",
      p_trace_id: traceId,
    });
    expect(first.error).toBeNull();
    expect(
      (first.data as { idempotent: boolean } | null)?.idempotent
    ).toBe(false);

    const [movement, account, occurrence, rule] = await Promise.all([
      admin.from("movements").select("status,deleted_at").eq("id", movementId).single(),
      admin.from("accounts").select("current_balance").eq("id", accountId).single(),
      admin
        .from("recurring_occurrences")
        .select("status,paid_at,paid_movement_id")
        .eq("id", occurrenceId)
        .single(),
      admin
        .from("recurring_rules")
        .select("next_expected_date,last_paid_at,last_paid_amount")
        .eq("id", ruleId)
        .single(),
    ]);

    expect(movement.data).toMatchObject({ status: "deleted" });
    expect(Number(account.data?.current_balance)).toBe(1000);
    expect(occurrence.data).toMatchObject({
      status: "expected",
      paid_at: null,
      paid_movement_id: null,
    });
    expect(rule.data).toMatchObject({
      next_expected_date: "2026-07-29",
      last_paid_at: null,
      last_paid_amount: null,
    });

    const replay = await admin.rpc("reverse_recurring_payment", {
      p_user_id: user.id,
      p_movement_id: movementId,
      p_reason: "Pago duplicado",
      p_mode: "soft_delete",
      p_trace_id: traceId,
    });
    expect(replay.error).toBeNull();
    expect(
      (replay.data as { idempotent: boolean } | null)?.idempotent
    ).toBe(true);
  });
});
