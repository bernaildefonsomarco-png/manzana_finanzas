import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import {
  buildReminderDrafts,
  type ReminderDraft,
} from "@/core/reminders/reminder-engine";
import type { ReminderKind } from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

// RUL-NOTIF-04: sin fila en nudge_preferences, el tipo está activo en la
// bandeja (dashboard) salvo `sin_registrar`, que empieza apagado en las dos
// columnas (AC-NOTIF-16).
async function isDashboardEnabled(client: Client, userId: string, kind: ReminderKind): Promise<boolean> {
  if (kind === "sin_registrar") {
    const { data } = await client
      .from("nudge_preferences")
      .select("enabled")
      .eq("user_id", userId)
      .eq("nudge_type", kind)
      .eq("channel", "dashboard")
      .maybeSingle();
    return data?.enabled === true;
  }
  const { data } = await client
    .from("nudge_preferences")
    .select("enabled")
    .eq("user_id", userId)
    .eq("nudge_type", kind)
    .eq("channel", "dashboard")
    .maybeSingle();
  return data ? data.enabled : true;
}

export async function evaluateRemindersForUser(
  client: Client,
  userId: string,
  now: Date = new Date(),
): Promise<{ created: number; skipped: number }> {
  const pause = await client
    .from("reminder_pauses")
    .select("paused_until")
    .eq("user_id", userId)
    .maybeSingle();
  const isPaused = Boolean(pause.data && new Date(pause.data.paused_until) > now);

  const [openSubjects, recurringDue, debtInstallmentsDue, pendingCount, lastMovement, unhealthyEmail] =
    await Promise.all([
      loadOpenSubjectKeys(client, userId),
      loadRecurringDue(client, userId, now),
      loadDebtInstallmentsDue(client, userId, now),
      countOpenPending(client, userId),
      loadLastMovementAt(client, userId),
      loadUnhealthyEmailSources(client, userId),
    ]);

  const drafts = buildReminderDrafts({
    now,
    recurringDue,
    debtInstallmentsDue,
    openPendingCount: pendingCount,
    lastMovementAt: lastMovement,
    lastAssistantOrCorrectionAt: lastMovement,
    unhealthyEmailSources: unhealthyEmail,
    existingOpenSubjectKeys: openSubjects,
    isPaused,
  });

  let created = 0;
  let skipped = 0;
  for (const draft of drafts) {
    const enabled = await isDashboardEnabled(client, userId, draft.kind);
    if (!enabled) {
      skipped += 1;
      continue;
    }
    const inserted = await insertReminder(client, userId, draft);
    if (inserted) created += 1;
    else skipped += 1;
  }

  return { created, skipped };
}

async function insertReminder(client: Client, userId: string, draft: ReminderDraft): Promise<boolean> {
  const { error } = await client.from("in_app_notifications").insert({
    user_id: userId,
    kind: draft.kind,
    subject_key: draft.subjectKey,
    title: draft.title,
    body: draft.body,
    action_url: draft.actionUrl,
    expires_at: draft.expiresAt,
  });
  // Conflicto = ya existe uno abierto para el mismo sujeto (índice único,
  // AC-NOTIF-07): no es un fallo, es la dedupe funcionando.
  if (error && error.code !== "23505") throw error;
  return !error;
}

async function loadOpenSubjectKeys(client: Client, userId: string): Promise<Set<string>> {
  const { data, error } = await client
    .from("in_app_notifications")
    .select("subject_key")
    .eq("user_id", userId)
    .is("resolved_at", null)
    .is("dismissed_at", null);
  if (error) throw error;
  return new Set((data ?? []).map((row) => row.subject_key));
}

async function loadRecurringDue(client: Client, userId: string, now: Date) {
  const horizon = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await client
    .from("recurring_occurrences")
    .select("expected_date,expected_amount,status,recurring_rules!inner(id,name,currency,linked_debt_id)")
    .eq("user_id", userId)
    .in("status", ["expected", "due_soon", "pending_confirmation", "overdue"])
    .lte("expected_date", horizon);
  if (error) throw error;

  type Row = {
    expected_date: string;
    expected_amount: number | null;
    status: string;
    recurring_rules: { id: string; name: string; currency: string; linked_debt_id: string | null } | null;
  };
  const today = now.toISOString().slice(0, 10);
  return ((data ?? []) as Row[])
    .filter((row) => row.recurring_rules && !row.recurring_rules.linked_debt_id)
    .map((row) => ({
      ruleId: row.recurring_rules!.id,
      ruleName: row.recurring_rules!.name,
      amount: row.expected_amount,
      currency: row.recurring_rules!.currency,
      expectedDate: row.expected_date,
      overdue: row.expected_date < today || row.status === "overdue",
    }));
}

async function loadDebtInstallmentsDue(client: Client, userId: string, now: Date) {
  const horizon = new Date(now.getTime() + 3 * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await client
    .from("debt_installments")
    .select("number,due_date,expected_amount,status,debts!inner(id,name,currency)")
    .eq("user_id", userId)
    .in("status", ["pending", "due_soon", "overdue"])
    .lte("due_date", horizon);
  if (error) throw error;

  type Row = {
    number: number;
    due_date: string;
    expected_amount: number;
    status: string;
    debts: { id: string; name: string; currency: string } | null;
  };
  const today = now.toISOString().slice(0, 10);
  return ((data ?? []) as Row[])
    .filter((row) => row.debts)
    .map((row) => ({
      debtId: row.debts!.id,
      debtName: row.debts!.name,
      number: row.number,
      amount: row.expected_amount,
      currency: row.debts!.currency,
      dueDate: row.due_date,
      overdue: row.due_date < today || row.status === "overdue",
    }));
}

async function countOpenPending(client: Client, userId: string): Promise<number> {
  const { count, error } = await client
    .from("pending_items")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("status", ["pending", "sent_for_confirmation", "user_edited"]);
  if (error) throw error;
  return count ?? 0;
}

async function loadLastMovementAt(client: Client, userId: string): Promise<string | null> {
  const { data, error } = await client
    .from("movements")
    .select("created_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.created_at ?? null;
}

async function loadUnhealthyEmailSources(client: Client, userId: string) {
  const { data, error } = await client
    .from("user_email_sources")
    .select("id,institution_key,status,updated_at")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("status", "disabled");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    label: row.institution_key.toUpperCase(),
    disconnectedSinceIso: row.updated_at,
  }));
}
