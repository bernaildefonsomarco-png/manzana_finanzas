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
  user = await crearUsuarioDePrueba("w11-recurring-skip");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-11: salto recurrente atómico", () => {
  it("RUL-REC-08: omite el periodo, avanza la regla y no revive el compromiso", async () => {
    const ruleId = randomUUID();
    const currentId = randomUUID();
    const nextId = randomUUID();
    expect(
      (
        await admin.from("recurring_rules").insert({
          id: ruleId,
          user_id: user.id,
          status: "active",
          name: "Internet para salto",
          expected_amount: 89,
          amount_variability: "fixed",
          currency: "PEN",
          frequency: "monthly",
          next_expected_date: "2026-08-10",
          requires_confirmation_for_payment: true,
        })
      ).error
    ).toBeNull();
    expect(
      (
        await admin.from("recurring_occurrences").insert([
          {
            id: currentId,
            user_id: user.id,
            recurring_rule_id: ruleId,
            expected_date: "2026-08-10",
            expected_amount: 89,
            status: "expected",
          },
          {
            id: nextId,
            user_id: user.id,
            recurring_rule_id: ruleId,
            expected_date: "2026-09-10",
            expected_amount: 89,
            status: "expected",
          },
        ])
      ).error
    ).toBeNull();

    const traceId = randomUUID();
    const first = await admin.rpc("commit_recurring_occurrence_skip", {
      p_user_id: user.id,
      p_recurring_rule_id: ruleId,
      p_occurrence_id: currentId,
      p_trace_id: traceId,
    });
    expect(first.error).toBeNull();
    expect(
      (first.data as { idempotent?: boolean } | null)?.idempotent
    ).toBe(false);

    const [occurrence, rule, events] = await Promise.all([
      admin
        .from("recurring_occurrences")
        .select("status")
        .eq("id", currentId)
        .single(),
      admin
        .from("recurring_rules")
        .select("next_expected_date")
        .eq("id", ruleId)
        .single(),
      admin
        .from("transactional_outbox")
        .select("id")
        .eq("aggregate_id", currentId)
        .eq("event_type", "recurring_occurrence_skipped"),
    ]);
    expect(occurrence.data?.status).toBe("skipped");
    expect(rule.data?.next_expected_date).toBe("2026-09-10");
    expect(events.data).toHaveLength(1);

    const replay = await admin.rpc("commit_recurring_occurrence_skip", {
      p_user_id: user.id,
      p_recurring_rule_id: ruleId,
      p_occurrence_id: currentId,
      p_trace_id: traceId,
    });
    expect(replay.error).toBeNull();
    expect(
      (replay.data as { idempotent?: boolean } | null)?.idempotent
    ).toBe(true);
  });

  it("authenticated no puede ejecutar el RPC especializado", async () => {
    const { error } = await user.client.rpc(
      "commit_recurring_occurrence_skip",
      {
        p_user_id: user.id,
        p_recurring_rule_id: randomUUID(),
        p_occurrence_id: randomUUID(),
        p_trace_id: randomUUID(),
      }
    );

    expect(error).not.toBeNull();
    expect(error?.message.toLowerCase() ?? "").toContain("permission denied");
  });

  it("el worker service-only enumera usuarios activos sin un limite implicito", async () => {
    const insert = await admin.from("recurring_rules").insert({
      user_id: user.id,
      status: "active",
      name: `Worker ${randomUUID()}`,
      expected_amount: 50,
      amount_variability: "fixed",
      currency: "PEN",
      frequency: "monthly",
      next_expected_date: "2026-09-01",
      requires_confirmation_for_payment: true,
    });
    expect(insert.error).toBeNull();

    const listed = await admin.rpc("list_recurring_generation_user_ids", {
      p_limit: null,
    });
    expect(listed.error).toBeNull();
    expect(
      listed.data?.map((row: { user_id: string }) => row.user_id)
    ).toContain(user.id);

    const blocked = await user.client.rpc(
      "list_recurring_generation_user_ids",
      { p_limit: null }
    );
    expect(blocked.error).not.toBeNull();
    expect(blocked.error?.message.toLowerCase() ?? "").toContain(
      "permission denied"
    );
  });
});
