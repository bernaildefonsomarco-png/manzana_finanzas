import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";

type Client = SupabaseClient<Database>;
type EmailKind = Database["public"]["Enums"]["email_kind"];
type EmailStatus = Database["public"]["Enums"]["email_status"];

export type EmailOutboxRow = {
  id: string;
  user_id: string;
  kind: EmailKind;
  template: string;
  subject: string;
  idempotency_key: string;
  scheduled_for: string;
  status: EmailStatus;
  attempts: number;
};

/**
 * `46` `RUL-MAIL-07` — encolar es idempotente por `(user_id, idempotency_key)`:
 * si el trabajo se reintenta, el `upsert` no crea una segunda fila.
 */
export async function enqueueEmail(
  client: Client,
  input: {
    userId: string;
    kind: EmailKind;
    template: string;
    subject: string;
    idempotencyKey: string;
    scheduledFor?: string;
  },
): Promise<void> {
  const { error } = await client
    .from("email_outbox")
    .upsert(
      {
        user_id: input.userId,
        kind: input.kind,
        template: input.template,
        subject: input.subject,
        idempotency_key: input.idempotencyKey,
        scheduled_for: input.scheduledFor ?? new Date().toISOString(),
        status: "pendiente",
      },
      { onConflict: "user_id,idempotency_key", ignoreDuplicates: true },
    );
  if (error) throw error;
}

export async function claimPendingEmails(client: Client, limit: number): Promise<EmailOutboxRow[]> {
  const { data, error } = await client
    .from("email_outbox")
    .select("id,user_id,kind,template,subject,idempotency_key,scheduled_for,status,attempts")
    .eq("status", "pendiente")
    .lte("scheduled_for", new Date().toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EmailOutboxRow[];
}

export async function markEmailSent(client: Client, id: string): Promise<void> {
  const { error } = await client
    .from("email_outbox")
    .update({ status: "enviado", sent_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markEmailDiscarded(
  client: Client,
  id: string,
  reason: string,
): Promise<void> {
  const { error } = await client
    .from("email_outbox")
    .update({ status: "descartado", discard_reason: reason })
    .eq("id", id);
  if (error) throw error;
}

export async function markEmailDeferred(
  client: Client,
  id: string,
  scheduledFor: string,
): Promise<void> {
  const { error } = await client.from("email_outbox").update({ scheduled_for: scheduledFor }).eq("id", id);
  if (error) throw error;
}

/** `RUL-MAIL-07`: reintentos con espera creciente, máximo 3 intentos. */
export async function markEmailFailed(
  client: Client,
  row: { id: string; attempts: number },
  errorMessage: string,
): Promise<void> {
  const attempts = row.attempts + 1;
  const terminal = attempts >= 3;
  const backoffMinutes = 2 ** attempts; // 2, 4, 8 minutos
  const { error } = await client
    .from("email_outbox")
    .update({
      attempts,
      last_error: errorMessage.slice(0, 500),
      status: terminal ? "fallido" : "pendiente",
      scheduled_for: terminal
        ? undefined
        : new Date(Date.now() + backoffMinutes * 60_000).toISOString(),
    })
    .eq("id", row.id);
  if (error) throw error;
}

export async function isAddressSuppressed(client: Client, userId: string): Promise<boolean> {
  const { data, error } = await client
    .from("email_suppressions")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function suppressAddress(
  client: Client,
  input: { userId: string; reason: Database["public"]["Enums"]["suppression_reason"]; detail?: string },
): Promise<void> {
  const { error } = await client
    .from("email_suppressions")
    .upsert({ user_id: input.userId, reason: input.reason, detail: input.detail ?? null });
  if (error) throw error;
}
