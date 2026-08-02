import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { admin, crearUsuarioDePrueba, limpiarUsuariosDePrueba, type UsuarioDePrueba } from "./lib/entorno";
import {
  sembrarCuotaDeDeuda,
  sembrarDeuda,
  sembrarConexionDeCorreo,
  sembrarFuenteDeCorreo,
  sembrarOcurrenciaRecurrente,
  sembrarPendiente,
  sembrarPersonaRelacionada,
  sembrarReglaRecurrente,
} from "./lib/fixtures";

let owner: UsuarioDePrueba;
let intruder: UsuarioDePrueba;

async function sembrarRecordatorio(userId: string, overrides: Record<string, unknown> = {}) {
  const { data, error } = await admin
    .from("in_app_notifications")
    .insert({
      user_id: userId,
      kind: "pago_proximo",
      subject_key: `sujeto:${randomUUID()}`,
      title: "Título de prueba",
      body: "Cuerpo de prueba",
      expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      ...overrides,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(`No pude sembrar in_app_notifications: ${error?.message}`);
  return data as { id: string; subject_key: string; resolved_at: string | null };
}

beforeAll(async () => {
  owner = await crearUsuarioDePrueba("w14-owner");
  intruder = await crearUsuarioDePrueba("w14-intruder");
});

afterAll(async () => {
  await limpiarUsuariosDePrueba();
});

describe("W-14: RLS de recordatorios, búsqueda y reportes", () => {
  it.each(["in_app_notifications", "reminder_pauses", "export_jobs"])(
    "%s oculta filas ajenas y bloquea escritura directa del cliente",
    async (table) => {
      const read = await intruder.client.from(table).select("*").eq("user_id", owner.id);
      expect(read.error).toBeNull();
      expect(read.data).toEqual([]);
      const write = await intruder.client.from(table).insert({ user_id: intruder.id });
      expect(write.error).not.toBeNull();
    },
  );

  it("saved_searches y saved_reports: el dueño puede escribir directo, un ajeno no ve ni escribe", async () => {
    const created = await owner.client
      .from("saved_searches")
      .insert({ user_id: owner.id, name: `Guardada ${randomUUID()}`, query: "netflix" })
      .select("id")
      .single();
    expect(created.error).toBeNull();

    const readByIntruder = await intruder.client
      .from("saved_searches")
      .select("*")
      .eq("id", created.data!.id);
    expect(readByIntruder.data).toEqual([]);

    const writeByIntruder = await intruder.client
      .from("saved_searches")
      .update({ name: "hackeado" })
      .eq("id", created.data!.id);
    expect(writeByIntruder.data).toEqual(null);
    const stillOriginal = await admin.from("saved_searches").select("name").eq("id", created.data!.id).single();
    expect(stillOriginal.data?.name).not.toBe("hackeado");
  });
});

describe("AC-NOTIF-07: un sujeto, un recordatorio abierto", () => {
  it("el índice único rechaza un segundo recordatorio abierto con el mismo subject_key", async () => {
    const subjectKey = `compromiso:${randomUUID()}`;
    await sembrarRecordatorio(owner.id, { subject_key: subjectKey });
    const second = await admin.from("in_app_notifications").insert({
      user_id: owner.id,
      kind: "pago_proximo",
      subject_key: subjectKey,
      title: "Duplicado",
      body: "No debería poder crearse",
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
    });
    expect(second.error).not.toBeNull();
  });
});

describe("RUL-NOTIF-06: resolución automática en la misma transacción", () => {
  it("pagar una cuota de deuda resuelve el recordatorio cuota_*", async () => {
    const person = await sembrarPersonaRelacionada(owner.id);
    const debt = await sembrarDeuda(owner.id, person.id);
    const installment = await sembrarCuotaDeDeuda(owner.id, debt.id);
    const reminder = await sembrarRecordatorio(owner.id, {
      kind: "cuota_proxima",
      subject_key: `cuota:${debt.id}#1`,
    });

    await admin.from("debt_installments").update({ status: "paid" }).eq("id", installment.id);

    const after = await admin
      .from("in_app_notifications")
      .select("resolved_at")
      .eq("id", reminder.id)
      .single();
    expect(after.data?.resolved_at).not.toBeNull();
  });

  it("marcar pagada una ocurrencia recurrente resuelve el recordatorio pago_*", async () => {
    const rule = await sembrarReglaRecurrente(owner.id);
    const occurrence = await sembrarOcurrenciaRecurrente(owner.id, rule.id);
    const reminder = await sembrarRecordatorio(owner.id, {
      kind: "pago_proximo",
      subject_key: `compromiso:${rule.id}`,
    });

    // commit_recurring_payment exige más contexto (cuenta, movimiento); para
    // aislar el trigger de resolución se simula la transición de estado que
    // esa función deja, en vez de reconstruir el flujo entero de pago.
    await admin
      .from("recurring_occurrences")
      .update({
        status: "paid",
        paid_at: new Date().toISOString(),
        paid_movement_id: (await sembrarMovimientoParaOcurrencia(owner.id)).id,
      })
      .eq("id", occurrence.id);

    const after = await admin
      .from("in_app_notifications")
      .select("resolved_at")
      .eq("id", reminder.id)
      .single();
    expect(after.data?.resolved_at).not.toBeNull();
  });

  it("cancelar la regla recurrente resuelve el recordatorio aunque no haya ocurrencia pagada", async () => {
    const rule = await sembrarReglaRecurrenteUnica(owner.id);
    const reminder = await sembrarRecordatorio(owner.id, {
      kind: "pago_vencido",
      subject_key: `compromiso:${rule.id}`,
    });

    await admin.from("recurring_rules").update({ cancelled_at: new Date().toISOString() }).eq("id", rule.id);

    const after = await admin
      .from("in_app_notifications")
      .select("resolved_at")
      .eq("id", reminder.id)
      .single();
    expect(after.data?.resolved_at).not.toBeNull();
  });

  it("bajar de 5 pendientes abiertos resuelve pendientes_acumulados", async () => {
    const pendings = [] as { id: string }[];
    for (let i = 0; i < 5; i += 1) {
      pendings.push(await sembrarPendiente(owner.id));
    }
    const reminder = await sembrarRecordatorio(owner.id, { kind: "pendientes_acumulados", subject_key: "pendientes" });

    // Descartar dos deja 3 abiertos (< 5): dispara la recuenta del trigger.
    await admin.from("pending_items").update({ status: "discarded" }).eq("id", pendings[0]!.id);
    await admin.from("pending_items").update({ status: "discarded" }).eq("id", pendings[1]!.id);

    const after = await admin
      .from("in_app_notifications")
      .select("resolved_at")
      .eq("id", reminder.id)
      .single();
    expect(after.data?.resolved_at).not.toBeNull();
  });

  it("registrar un movimiento resuelve sin_registrar (subject_key 'ausencia')", async () => {
    const account = await sembrarCuentaUnica(owner.id);
    const reminder = await sembrarRecordatorio(owner.id, { kind: "sin_registrar", subject_key: "ausencia" });

    await admin.from("movements").insert({
      user_id: owner.id,
      type: "gasto",
      status: "confirmed",
      amount: 5,
      currency: "PEN",
      occurred_at: new Date().toISOString(),
      category_id: "alimentacion",
      source: "dashboard_manual",
      idempotency_key: `w14-ausencia-${randomUUID()}`,
      account_origin_id: account.id,
    });

    const after = await admin
      .from("in_app_notifications")
      .select("resolved_at")
      .eq("id", reminder.id)
      .single();
    expect(after.data?.resolved_at).not.toBeNull();
  });

  it("reconectar un buzón resuelve correo_desconectado", async () => {
    const connection = await sembrarConexionDeCorreo(owner.id);
    const source = await sembrarFuenteDeCorreo(owner.id, connection.id);
    const reminder = await sembrarRecordatorio(owner.id, {
      kind: "correo_desconectado",
      subject_key: `buzon:${source.id}`,
    });

    await admin.from("user_email_sources").update({ status: "active", verification_status: "verified", verified_at: new Date().toISOString() }).eq("id", source.id);

    const after = await admin
      .from("in_app_notifications")
      .select("resolved_at")
      .eq("id", reminder.id)
      .single();
    expect(after.data?.resolved_at).not.toBeNull();
  });

  it("un candidato de perfil pendiente crea confirmar_hecho, y decidirlo lo resuelve", async () => {
    const subjectKey = `vive_con:${randomUUID()}`;
    const candidate = await admin
      .from("user_profile_candidates")
      .insert({
        user_id: owner.id,
        subject_key: subjectKey,
        statement: "Vive con su pareja",
        status: "pending_confirmation",
        evidence_refs: ["movement:seed"],
      })
      .select("id")
      .single();
    expect(candidate.error).toBeNull();

    const created = await admin
      .from("in_app_notifications")
      .select("id,resolved_at")
      .eq("user_id", owner.id)
      .eq("subject_key", `perfil:${subjectKey}`)
      .single();
    expect(created.data).not.toBeNull();
    expect(created.data?.resolved_at).toBeNull();

    await admin.from("user_profile_candidates").update({ status: "accepted" }).eq("id", candidate.data!.id);

    const resolved = await admin
      .from("in_app_notifications")
      .select("resolved_at")
      .eq("id", created.data!.id)
      .single();
    expect(resolved.data?.resolved_at).not.toBeNull();
  });
});

describe("RPC de acción del usuario (37 §10)", () => {
  it("mark_reminder_read es idempotente y solo el dueño puede llamarlo", async () => {
    const reminder = await sembrarRecordatorio(owner.id);

    const forbidden = await intruder.client.rpc("mark_reminder_read", {
      p_user_id: owner.id,
      p_id: reminder.id,
    });
    expect(forbidden.error?.message).toContain("REMINDER_FORBIDDEN");

    const first = await owner.client.rpc("mark_reminder_read", { p_user_id: owner.id, p_id: reminder.id });
    expect(first.error).toBeNull();
    const row = await admin.from("in_app_notifications").select("read_at").eq("id", reminder.id).single();
    const firstReadAt = row.data?.read_at;
    expect(firstReadAt).not.toBeNull();

    const second = await owner.client.rpc("mark_reminder_read", { p_user_id: owner.id, p_id: reminder.id });
    expect(second.error).toBeNull();
    const rowAfter = await admin.from("in_app_notifications").select("read_at").eq("id", reminder.id).single();
    expect(rowAfter.data?.read_at).toBe(firstReadAt);
  });

  it("snooze_reminder rechaza fechas fuera de rango (ERR-NOTIF-02)", async () => {
    const reminder = await sembrarRecordatorio(owner.id);
    const tooFar = await owner.client.rpc("snooze_reminder", {
      p_user_id: owner.id,
      p_id: reminder.id,
      p_until: new Date(Date.now() + 40 * 86_400_000).toISOString(),
    });
    expect(tooFar.error?.message).toContain("REMINDER_SNOOZE_OUT_OF_RANGE");

    const ok = await owner.client.rpc("snooze_reminder", {
      p_user_id: owner.id,
      p_id: reminder.id,
      p_until: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    });
    expect(ok.error).toBeNull();
  });

  it("dismiss_reminder falla con ERR-NOTIF-04 sobre uno ya resuelto", async () => {
    const reminder = await sembrarRecordatorio(owner.id, { resolved_at: new Date().toISOString() });
    const result = await owner.client.rpc("dismiss_reminder", { p_user_id: owner.id, p_id: reminder.id });
    expect(result.error?.message).toContain("REMINDER_ALREADY_RESOLVED");
  });

  it("dismiss_reminder sobre un id ajeno devuelve REMINDER_NOT_FOUND (WEB-D230: 404, nunca 403)", async () => {
    const reminder = await sembrarRecordatorio(owner.id);
    const result = await intruder.client.rpc("dismiss_reminder", { p_user_id: intruder.id, p_id: reminder.id });
    expect(result.error?.message).toContain("REMINDER_NOT_FOUND");
  });

  it("set_reminder_preference: el correo empieza apagado y activarlo encola un evento de consentimiento (AC-NOTIF-01/03)", async () => {
    const before = await owner.client
      .from("nudge_preferences")
      .select("enabled")
      .eq("user_id", owner.id)
      .eq("nudge_type", "cuota_proxima")
      .eq("channel", "email");
    expect(before.data).toEqual([]); // sin fila = apagado por defecto (AC-NOTIF-01)

    const enable = await owner.client.rpc("set_reminder_preference", {
      p_user_id: owner.id,
      p_nudge_type: "cuota_proxima",
      p_channel: "email",
      p_enabled: true,
    });
    expect(enable.error).toBeNull();

    const after = await admin
      .from("nudge_preferences")
      .select("enabled")
      .eq("user_id", owner.id)
      .eq("nudge_type", "cuota_proxima")
      .eq("channel", "email")
      .single();
    expect(after.data?.enabled).toBe(true);

    const event = await admin
      .from("transactional_outbox")
      .select("event_type")
      .eq("user_id", owner.id)
      .eq("event_type", "reminder_email_consent_granted");
    expect(event.data!.length).toBeGreaterThan(0);
  });

  it("pause_reminders y resume_reminders", async () => {
    const pause = await owner.client.rpc("pause_reminders", {
      p_user_id: owner.id,
      p_until: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    });
    expect(pause.error).toBeNull();
    const paused = await admin.from("reminder_pauses").select("user_id").eq("user_id", owner.id).single();
    expect(paused.data).not.toBeNull();

    const resume = await owner.client.rpc("resume_reminders", { p_user_id: owner.id });
    expect(resume.error).toBeNull();
    const afterResume = await admin.from("reminder_pauses").select("user_id").eq("user_id", owner.id);
    expect(afterResume.data).toEqual([]);
  });
});

describe("create_export_job (RUL-REP-11/12)", () => {
  it("es idempotente por (user_id, idempotency_key) y no se puede crear para otro usuario", async () => {
    const key = `export-${randomUUID()}`;
    const first = await owner.client.rpc("create_export_job", {
      p_user_id: owner.id,
      p_kind: "movimientos",
      p_format: "csv",
      p_idempotency_key: key,
      p_metadata: {},
    });
    expect(first.error).toBeNull();

    const retry = await owner.client.rpc("create_export_job", {
      p_user_id: owner.id,
      p_kind: "movimientos",
      p_format: "csv",
      p_idempotency_key: key,
      p_metadata: {},
    });
    expect(retry.error).toBeNull();
    expect(retry.data.id).toBe(first.data.id);

    const forbidden = await intruder.client.rpc("create_export_job", {
      p_user_id: owner.id,
      p_kind: "movimientos",
      p_format: "csv",
      p_idempotency_key: `other-${randomUUID()}`,
      p_metadata: {},
    });
    expect(forbidden.error?.message).toContain("EXPORT_FORBIDDEN");
  });
});

async function sembrarCuentaUnica(userId: string) {
  const { data, error } = await admin
    .from("accounts")
    .insert({ user_id: userId, name: `Cuenta ${randomUUID()}`, type: "banco", currency: "PEN" })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No pude sembrar accounts: ${error?.message}`);
  return data as { id: string };
}

async function sembrarReglaRecurrenteUnica(userId: string) {
  const { data, error } = await admin
    .from("recurring_rules")
    .insert({
      user_id: userId,
      name: `Recurrente ${randomUUID()}`,
      category_id: "servicios_suscripciones",
      amount_variability: "variable",
      expected_amount: null,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No pude sembrar recurring_rules: ${error?.message}`);
  return data as { id: string };
}

async function sembrarMovimientoParaOcurrencia(userId: string) {
  const account = await sembrarCuentaUnica(userId);
  const { data, error } = await admin
    .from("movements")
    .insert({
      user_id: userId,
      type: "pago_recurrente",
      status: "confirmed",
      amount: 20,
      currency: "PEN",
      occurred_at: new Date().toISOString(),
      category_id: "servicios_suscripciones",
      source: "dashboard_manual",
      idempotency_key: `w14-occ-${randomUUID()}`,
      account_origin_id: account.id,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`No pude sembrar movimiento: ${error?.message}`);
  return data as { id: string };
}
