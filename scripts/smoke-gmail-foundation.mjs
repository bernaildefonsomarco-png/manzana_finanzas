import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

loadEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Faltan credenciales Supabase para el smoke Gmail.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const userEmail = `gmail-smoke-${runId}@example.invalid`;
const gmailAddress = `gmail-${runId}@example.invalid`;
const sender = `alerts-${runId}@bank.example`;
const password = `Smoke-${randomUUID()}-Aa1!`;
let userId = null;
let templateId = null;

try {
  const created = await admin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) throw created.error ?? new Error("Sin usuario");
  userId = created.data.user.id;

  const signedIn = await authClient.auth.signInWithPassword({
    email: userEmail,
    password,
  });
  if (signedIn.error) throw signedIn.error;

  const template = await admin
    .from("email_parse_templates")
    .insert({
      institution_key: `smoke_${runId.slice(0, 8)}`,
      sender_pattern: sender,
      template_version: "smoke-v1",
      enabled: true,
      activation_mode: "active",
      verification_status: "verified",
      verified_at: new Date().toISOString(),
      sample_hashes: ["1", "2", "3", "4", "5"].map((value) =>
        value.repeat(64),
      ),
      priority: 1,
      parser_config: {
        schema_version: "gmail_parser_v1",
        subject_patterns: ["Smoke financiero"],
        extraction_rules: {
          amount: {
            pattern: "(?:S/|PEN)\\s*([\\d.,]+)",
            type: "number",
          },
          direction: "out",
          currency: "PEN",
        },
        allow_generic_fallback: true,
        confidence: { template: 0.93, fallback: 0.55 },
        institution_aliases: ["Banco fixture"],
      },
      metadata: { fixture: true, run_id: runId },
    })
    .select("id")
    .single();
  if (template.error) throw template.error;
  templateId = template.data.id;

  const traceId = randomUUID();
  const connected = await admin.rpc("commit_gmail_connection", {
    p_user_id: userId,
    p_email_address: gmailAddress,
    p_scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    p_encrypted_refresh_token: "v1.fixture.fixture.fixture",
    p_history_id: "100",
    p_watch_expiration: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString(),
    p_trace_id: traceId,
  });
  if (connected.error) throw connected.error;

  const notification = {
    p_email_address: gmailAddress,
    p_pubsub_message_id: `pubsub-${runId}`,
    p_history_id: "101",
    p_publish_time: new Date().toISOString(),
    p_subscription: "projects/smoke/subscriptions/gmail",
    p_payload_hash: "a".repeat(64),
    p_trace_id: traceId,
  };
  const firstNotification = await admin.rpc(
    "enqueue_gmail_history_notification",
    notification,
  );
  const repeatedNotification = await admin.rpc(
    "enqueue_gmail_history_notification",
    notification,
  );
  if (firstNotification.error) throw firstNotification.error;
  if (repeatedNotification.error) throw repeatedNotification.error;
  assert(firstNotification.data.accepted === true, "notificacion aceptada");
  assert(firstNotification.data.duplicate === false, "primera notificacion no duplicada");
  assert(repeatedNotification.data.duplicate === true, "reintento Pub/Sub idempotente");

  const messageInput = {
    p_user_id: userId,
    p_connection_id: connected.data.id,
    p_provider_message_id: `gmail-message-${runId}`,
    p_provider_thread_id: `gmail-thread-${runId}`,
    p_received_at: new Date().toISOString(),
    p_sender: sender,
    p_subject_hash: "b".repeat(64),
    p_content_hash: "c".repeat(64),
    p_parsed_status: "parsed",
    p_pending: {
      proposed_action: {
        action: "create_movement",
        movement_type: "gasto",
        movement_input: {
          type: "gasto",
          amount: 25,
          currency: "PEN",
          occurred_at: new Date().toISOString(),
          source: "email_confirmed",
          requires_review: true,
        },
      },
      normalized_summary: {
        title: "Compra fixture Gmail",
        amount: 25,
        currency: "PEN",
        occurred_at: new Date().toISOString(),
      },
      dedup_status: "unique",
      risk_level: "low",
      metadata: {
        fixture: true,
        content_persisted: false,
        template_id: templateId,
      },
    },
    p_metadata: {
      fixture: true,
      content_persisted: false,
      template_id: templateId,
      parse_mode: "template",
      processing_latency_ms: 10,
    },
    p_trace_id: traceId,
  };
  const firstMessage = await admin.rpc("commit_email_message_outcome", messageInput);
  const repeatedMessage = await admin.rpc("commit_email_message_outcome", messageInput);
  if (firstMessage.error) throw firstMessage.error;
  if (repeatedMessage.error) throw repeatedMessage.error;
  assert(firstMessage.data.idempotent === false, "primer mensaje Gmail creado");
  assert(Boolean(firstMessage.data.pending_item_id), "mensaje crea Pendiente");
  assert(repeatedMessage.data.idempotent === true, "reintento de mensaje idempotente");
  const repeatedContent = await admin.rpc("commit_email_message_outcome", {
    ...messageInput,
    p_provider_message_id: `gmail-message-content-copy-${runId}`,
    p_provider_thread_id: `gmail-thread-content-copy-${runId}`,
  });
  if (repeatedContent.error) throw repeatedContent.error;
  assert(repeatedContent.data.idempotent === true, "contenido repetido idempotente");
  assert(
    repeatedContent.data.dedup_reason === "content_hash_24h",
    "contenido repetido usa dedup de 24 horas",
  );

  const shadowed = await admin
    .from("email_parse_templates")
    .update({ activation_mode: "shadow" })
    .eq("id", templateId);
  if (shadowed.error) throw shadowed.error;
  const blockedShadowWrite = await admin.rpc("commit_email_message_outcome", {
    ...messageInput,
    p_provider_message_id: `gmail-message-shadow-${runId}`,
    p_subject_hash: "d".repeat(64),
    p_content_hash: "e".repeat(64),
  });
  assert(
    Boolean(blockedShadowWrite.error) &&
      blockedShadowWrite.error.message.includes("EMAIL_PENDING_TEMPLATE_NOT_ACTIVE"),
    "template shadow no puede crear Pendiente",
  );
  const reactivated = await admin
    .from("email_parse_templates")
    .update({ activation_mode: "active" })
    .eq("id", templateId);
  if (reactivated.error) throw reactivated.error;

  const backfillMessage = await admin.rpc("commit_email_message_outcome", {
    ...messageInput,
    p_provider_message_id: `gmail-message-backfill-${runId}`,
    p_provider_thread_id: `gmail-thread-backfill-${runId}`,
    p_subject_hash: "f".repeat(64),
    p_content_hash: "9".repeat(64),
    p_metadata: {
      ...messageInput.p_metadata,
      entry_surface: "gmail_backfill_30d",
    },
  });
  if (backfillMessage.error) throw backfillMessage.error;
  assert(Boolean(backfillMessage.data.pending_item_id), "backfill crea Pendiente");
  const backfillPending = await admin
    .from("pending_items")
    .select("source,type,metadata")
    .eq("id", backfillMessage.data.pending_item_id)
    .single();
  if (backfillPending.error) throw backfillPending.error;
  assert(
    backfillPending.data.source === "backfill_pending",
    "backfill usa fuente separada",
  );
  assert(
    backfillPending.data.type === "backfill_item",
    "backfill usa tipo separado",
  );
  assert(
    backfillPending.data.metadata.delivery_channel === "dashboard_only",
    "backfill queda solo en Dashboard",
  );

  const health = await admin.rpc("get_email_capture_health", { p_days: 7 });
  if (health.error) throw health.error;
  const templateHealth = health.data.templates.find(
    (item) => item.institution_key === `smoke_${runId.slice(0, 8)}`,
  );
  assert(Boolean(templateHealth), "health incluye template fixture");
  assert(templateHealth.match_count === 2, "health cuenta parses activos");

  const [messageCount, pendingCount, movementCount, notificationOutboxCount] =
    await Promise.all([
      count("email_messages", "user_id", userId),
      count("pending_items", "user_id", userId),
      count("movements", "user_id", userId),
      count(
        "transactional_outbox",
        "event_type",
        "gmail_history_notification",
        userId,
      ),
    ]);
  assert(messageCount === 2, "dos emails unicos pese a reintentos");
  assert(pendingCount === 2, "dos Pendientes unicos pese a reintentos");
  assert(movementCount === 0, "Gmail nunca crea movimiento confirmado");
  assert(notificationOutboxCount === 1, "una entrega outbox por notificacion");

  const denied = await authClient.from("email_connections").select("id");
  assert(Boolean(denied.error), "RLS/grants bloquean lectura directa autenticada");

  const disconnected = await admin.rpc("disconnect_gmail_connection", {
    p_user_id: userId,
    p_trace_id: randomUUID(),
  });
  if (disconnected.error) throw disconnected.error;
  const [connectionAfter, pendingAfter] = await Promise.all([
    admin
      .from("email_connections")
      .select("status,encrypted_refresh_token")
      .eq("user_id", userId)
      .single(),
    admin
      .from("pending_items")
      .select("status")
      .eq("user_id", userId),
  ]);
  if (connectionAfter.error) throw connectionAfter.error;
  if (pendingAfter.error) throw pendingAfter.error;
  assert(connectionAfter.data.status === "disconnected", "conexion desconectada");
  assert(connectionAfter.data.encrypted_refresh_token === null, "token eliminado");
  assert(
    pendingAfter.data.length === 2 &&
      pendingAfter.data.every((item) => item.status === "archived"),
    "Pendientes abiertos archivados",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        run_id: runId,
        invariants: {
          oauth_commit_atomic: true,
          pubsub_retry_idempotent: true,
          email_pending_retry_idempotent: true,
          email_content_hash_dedup_24h: true,
          backfill_dashboard_only: true,
          financial_movements_created: 0,
          authenticated_direct_access_blocked: true,
          disconnect_deleted_token: true,
          disconnect_archived_pending: true,
          shadow_cannot_create_pending: true,
          capture_health_measured: true,
        },
      },
      null,
      2,
    ),
  );
} finally {
  if (templateId) await admin.from("email_parse_templates").delete().eq("id", templateId);
  if (userId) {
    await admin.from("external_event_log").delete().eq("user_id", userId);
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error) throw deleted.error;
  }
}

async function count(table, column, value, userFilter = null) {
  let query = admin.from(table).select("*", { count: "exact", head: true }).eq(column, value);
  if (userFilter) query = query.eq("user_id", userFilter);
  const result = await query;
  if (result.error) throw result.error;
  return result.count ?? 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke Gmail fallo: ${message}`);
}

function loadEnv(path) {
  if (!existsSync(path)) return;
  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}
