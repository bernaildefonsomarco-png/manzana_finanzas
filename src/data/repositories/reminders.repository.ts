import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import {
  computeReminderStatus,
  type InAppNotification,
  type NudgeType,
  type ReminderKind,
  type ReminderStatus,
} from "@/shared/types/domain";
import { priorityForKind } from "@/core/reminders/reminder-engine";

type Client = SupabaseClient<Database>;

export class ReminderRepositoryError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CONFLICT" | "FORBIDDEN" | "INVALID_OPERATION",
    message: string,
  ) {
    super(message);
    this.name = "ReminderRepositoryError";
  }
}

function mapRpcError(message: string): ReminderRepositoryError {
  if (message.includes("REMINDER_NOT_FOUND")) {
    return new ReminderRepositoryError("NOT_FOUND", "Ese recordatorio ya no está.");
  }
  if (message.includes("REMINDER_ALREADY_RESOLVED")) {
    return new ReminderRepositoryError("CONFLICT", "Eso ya está resuelto.");
  }
  if (message.includes("REMINDER_SNOOZE_OUT_OF_RANGE")) {
    return new ReminderRepositoryError(
      "INVALID_OPERATION",
      "Puedo recordártelo hasta dentro de un mes.",
    );
  }
  if (message.includes("REMINDER_PAUSE_OUT_OF_RANGE")) {
    return new ReminderRepositoryError("INVALID_OPERATION", "Elige una fecha futura.");
  }
  if (message.includes("REMINDER_CHANNEL_UNKNOWN")) {
    return new ReminderRepositoryError("INVALID_OPERATION", "Canal desconocido.");
  }
  if (message.includes("REMINDER_FORBIDDEN")) {
    return new ReminderRepositoryError("FORBIDDEN", "No autorizado.");
  }
  return new ReminderRepositoryError("INVALID_OPERATION", message);
}

export type PublicReminder = {
  id: string;
  kind: ReminderKind;
  title: string;
  body: string;
  action_url: string | null;
  status: ReminderStatus;
  created_at: string;
  expires_at: string;
};

function toPublic(row: InAppNotification, now: Date): PublicReminder {
  return {
    id: row.id,
    kind: row.kind as ReminderKind,
    title: row.title,
    body: row.body,
    action_url: row.action_url,
    status: computeReminderStatus(row, now),
    created_at: row.created_at,
    expires_at: row.expires_at,
  };
}

export async function listReminders(
  client: Client,
  userId: string,
  input: { estado?: "abiertos" | "cerrados" } = {},
): Promise<PublicReminder[]> {
  const now = new Date();
  let query = client
    .from("in_app_notifications")
    .select("*")
    .eq("user_id", userId)
    .gt("expires_at", now.toISOString());

  if (input.estado === "cerrados") {
    query = client
      .from("in_app_notifications")
      .select("*")
      .eq("user_id", userId)
      .or("resolved_at.not.is.null,dismissed_at.not.is.null");
  } else {
    query = query.is("dismissed_at", null).is("resolved_at", null);
  }

  const { data, error } = await query.order("created_at", { ascending: false }).limit(200);
  if (error) throw error;

  const rows = (data ?? []) as InAppNotification[];
  return rows
    .map((row) => toPublic(row, now))
    .sort((a, b) => priorityForKind(b.kind) - priorityForKind(a.kind));
}

export async function countOpenReminders(client: Client, userId: string): Promise<number> {
  const { count, error } = await client
    .from("in_app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("dismissed_at", null)
    .is("resolved_at", null)
    .is("read_at", null)
    .gt("expires_at", new Date().toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function markReminderRead(client: Client, userId: string, id: string): Promise<void> {
  const { error } = await client.rpc("mark_reminder_read", { p_user_id: userId, p_id: id });
  if (error) throw mapRpcError(error.message);
}

export async function markAllRemindersRead(client: Client, userId: string): Promise<void> {
  const { error } = await client.rpc("mark_all_reminders_read", { p_user_id: userId });
  if (error) throw mapRpcError(error.message);
}

export async function snoozeReminder(
  client: Client,
  userId: string,
  id: string,
  until: string,
): Promise<void> {
  const { error } = await client.rpc("snooze_reminder", {
    p_user_id: userId,
    p_id: id,
    p_until: until,
  });
  if (error) throw mapRpcError(error.message);
}

export async function dismissReminder(client: Client, userId: string, id: string): Promise<void> {
  const { error } = await client.rpc("dismiss_reminder", { p_user_id: userId, p_id: id });
  if (error) throw mapRpcError(error.message);
}

export type ReminderPreferenceRow = {
  nudge_type: NudgeType;
  channel: "dashboard" | "email";
  enabled: boolean;
};

// RUL-NOTIF-04/AC-NOTIF-01: sin fila, la bandeja viene activa y el correo
// apagado. `sin_registrar` viene apagado en las dos columnas (AC-NOTIF-16).
export async function getReminderPreferences(
  client: Client,
  userId: string,
  types: ReminderKind[],
): Promise<ReminderPreferenceRow[]> {
  const { data, error } = await client
    .from("nudge_preferences")
    .select("nudge_type,channel,enabled")
    .eq("user_id", userId)
    .in("nudge_type", types)
    .in("channel", ["dashboard", "email"]);
  if (error) throw error;

  const rows = (data ?? []) as Array<{ nudge_type: string; channel: string; enabled: boolean }>;
  const result: ReminderPreferenceRow[] = [];
  for (const type of types) {
    for (const channel of ["dashboard", "email"] as const) {
      const row = rows.find((r) => r.nudge_type === type && r.channel === channel);
      const defaultEnabled = type === "sin_registrar" ? false : channel === "dashboard";
      result.push({
        nudge_type: type,
        channel,
        enabled: row ? row.enabled : defaultEnabled,
      });
    }
  }
  return result;
}

export async function setReminderPreference(
  client: Client,
  userId: string,
  input: { nudgeType: NudgeType; channel: "dashboard" | "email"; enabled: boolean },
): Promise<void> {
  const { error } = await client.rpc("set_reminder_preference", {
    p_user_id: userId,
    p_nudge_type: input.nudgeType,
    p_channel: input.channel,
    p_enabled: input.enabled,
  });
  if (error) throw mapRpcError(error.message);
}

export async function pauseReminders(client: Client, userId: string, until: string): Promise<void> {
  const { error } = await client.rpc("pause_reminders", { p_user_id: userId, p_until: until });
  if (error) throw mapRpcError(error.message);
}

export async function resumeReminders(client: Client, userId: string): Promise<void> {
  const { error } = await client.rpc("resume_reminders", { p_user_id: userId });
  if (error) throw mapRpcError(error.message);
}

// --- Variantes para el motor conversacional (`RUL-PREF-04`) -----------------
//
// `set_reminder_preference`, `pause_reminders` y `resume_reminders` abortan con
// `REMINDER_FORBIDDEN` si `auth.uid()` no es el dueno, asi que solo sirven
// cuando la peticion trae la sesion del usuario. `FinancialOrchestrator` corre
// siempre con el cliente de servicio —lo hace el asistente web y lo hace el
// webhook de mensajeria, que ni siquiera tiene usuario autenticado—, asi que
// para el la migracion `076` expone las variantes `*_for_user`: reciben el
// `user_id` explicito, estan concedidas **solo a `service_role`** y delegan en
// la funcion de siempre. Mismo patron que `071` para presupuestos y metas y que
// `075` para candidatos de perfil.
//
// El aislamiento por usuario no se debilita: pasa de venir de un token a venir
// de un parametro obligatorio que el motor toma del `external_event_log` ya
// autenticado. Y sigue cerrado para los demas: `authenticated` y `anon` no
// pueden ejecutar estas variantes, asi que ningun cliente puede pasar el
// `user_id` de otra persona. La pantalla sigue usando las funciones originales.

/**
 * Los RPC de `076` son nuevos y todavia no estan en los tipos generados de
 * Supabase. Mismo puente que usa `profile-candidates.repository.ts` para los de
 * `075`: se llama por nombre y se comprueba el error al leerlo, en vez de
 * mentirle al tipo generado.
 */
async function callRpc(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ error: { message: string } | null }> {
  const rpc = client.rpc as unknown as (
    functionName: string,
    functionArgs: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
  return rpc(name, args);
}

export async function setReminderPreferenceForUser(
  client: Client,
  userId: string,
  input: { nudgeType: NudgeType; channel: "dashboard" | "email"; enabled: boolean },
): Promise<void> {
  const { error } = await callRpc(client, "set_reminder_preference_for_user", {
    p_user_id: userId,
    p_nudge_type: input.nudgeType,
    p_channel: input.channel,
    p_enabled: input.enabled,
  });
  if (error) throw mapRpcError(error.message);
}

export async function pauseRemindersForUser(
  client: Client,
  userId: string,
  until: string,
): Promise<void> {
  const { error } = await callRpc(client, "pause_reminders_for_user", {
    p_user_id: userId,
    p_until: until,
  });
  if (error) throw mapRpcError(error.message);
}

export async function resumeRemindersForUser(
  client: Client,
  userId: string,
): Promise<void> {
  const { error } = await callRpc(client, "resume_reminders_for_user", {
    p_user_id: userId,
  });
  if (error) throw mapRpcError(error.message);
}

/**
 * El horario silencioso vive en `user_preferences.quiet_hours_start/end`, y
 * hasta `076` la unica escritura que lo tocaba era
 * `set_whatsapp_nudge_consent`, que ademas sella un evento de consentimiento de
 * un canal externo con `source: 'dashboard_settings'`. Reutilizarla para
 * cambiar solo el horario habria registrado un consentimiento que nadie dio, y
 * en el sitio equivocado. Por eso `076` crea una funcion que escribe **solo** el
 * horario y nada mas.
 */
export async function setQuietHoursForUser(
  client: Client,
  userId: string,
  input: { desde: string; hasta: string },
): Promise<void> {
  const { error } = await callRpc(client, "set_quiet_hours_for_user", {
    p_user_id: userId,
    p_start: input.desde,
    p_end: input.hasta,
  });
  if (error) throw mapRpcError(error.message);
}

export async function getReminderPause(
  client: Client,
  userId: string,
): Promise<{ paused_until: string } | null> {
  const { data, error } = await client
    .from("reminder_pauses")
    .select("paused_until")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
