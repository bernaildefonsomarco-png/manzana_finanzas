import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, crearUsuarioDePrueba, limpiarUsuariosDePrueba, type UsuarioDePrueba } from "./lib/entorno";
import { evaluateRemindersForUser } from "../../src/data/repositories/reminders-evaluate.repository";

let owner: UsuarioDePrueba;

beforeAll(async () => {
  owner = await crearUsuarioDePrueba("w14-evaluate-owner");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("evaluateRemindersForUser: end-to-end contra Postgres real", () => {
  it("una ocurrencia recurrente próxima produce un recordatorio pago_proximo real en la bandeja", async () => {
    const rule = await admin
      .from("recurring_rules")
      .insert({ user_id: owner.id, name: `Alquiler ${randomUUID()}`, category_id: "vivienda_hogar", expected_amount: 850 })
      .select("id")
      .single();
    expect(rule.error).toBeNull();

    await admin.from("recurring_occurrences").insert({
      user_id: owner.id,
      recurring_rule_id: rule.data!.id,
      expected_date: new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10),
      expected_amount: 850,
      status: "due_soon",
    });

    const result = await evaluateRemindersForUser(admin, owner.id);
    expect(result.created).toBeGreaterThanOrEqual(1);

    const reminder = await admin
      .from("in_app_notifications")
      .select("kind,subject_key,title")
      .eq("user_id", owner.id)
      .eq("subject_key", `compromiso:${rule.data!.id}`)
      .maybeSingle();
    expect(reminder.data?.kind).toBe("pago_proximo");
    expect(reminder.data?.title).toContain("S/850.00");
  });

  it("correr el evaluador dos veces no duplica el mismo recordatorio (RUL-NOTIF-07 vía el índice único)", async () => {
    const rule = await admin
      .from("recurring_rules")
      .insert({ user_id: owner.id, name: `Internet ${randomUUID()}`, category_id: "servicios_suscripciones", expected_amount: 120 })
      .select("id")
      .single();
    await admin.from("recurring_occurrences").insert({
      user_id: owner.id,
      recurring_rule_id: rule.data!.id,
      expected_date: new Date(Date.now() + 1 * 86_400_000).toISOString().slice(0, 10),
      expected_amount: 120,
      status: "due_soon",
    });

    await evaluateRemindersForUser(admin, owner.id);
    await evaluateRemindersForUser(admin, owner.id);

    const { data, error } = await admin
      .from("in_app_notifications")
      .select("id")
      .eq("user_id", owner.id)
      .eq("subject_key", `compromiso:${rule.data!.id}`);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it("un usuario con una pausa vigente no recibe recordatorios nuevos", async () => {
    const paused = await crearUsuarioDePrueba("w14-evaluate-paused");
    await admin.from("reminder_pauses").insert({
      user_id: paused.id,
      paused_until: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    });
    const rule = await admin
      .from("recurring_rules")
      .insert({ user_id: paused.id, name: `Gimnasio ${randomUUID()}`, category_id: "salud", expected_amount: 90 })
      .select("id")
      .single();
    await admin.from("recurring_occurrences").insert({
      user_id: paused.id,
      recurring_rule_id: rule.data!.id,
      expected_date: new Date(Date.now() + 1 * 86_400_000).toISOString().slice(0, 10),
      expected_amount: 90,
      status: "due_soon",
    });

    const result = await evaluateRemindersForUser(admin, paused.id);
    expect(result.created).toBe(0);
  });
});
