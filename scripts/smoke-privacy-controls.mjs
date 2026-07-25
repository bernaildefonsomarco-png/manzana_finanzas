import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

loadEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL ?? "https://manzana.website";
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error("Faltan credenciales Supabase para el smoke de privacidad.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const userEmail = `privacy-smoke-${runId}@example.invalid`;
const gmailAddress = `privacy-gmail-${runId}@example.invalid`;
const password = `Smoke-${randomUUID()}-Aa1!`;
let userId = null;
let externalEventId = null;

try {
  const created = await admin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error("No se creo usuario de privacidad");
  }
  userId = created.data.user.id;

  const signedIn = await authClient.auth.signInWithPassword({
    email: userEmail,
    password,
  });
  if (signedIn.error || !signedIn.data.session) {
    throw signedIn.error ?? new Error("No se obtuvo sesion de privacidad");
  }
  const accessToken = signedIn.data.session.access_token;
  const traceId = randomUUID();

  const connected = await admin.rpc("commit_gmail_connection", {
    p_user_id: userId,
    p_email_address: gmailAddress,
    p_scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    p_encrypted_refresh_token: "v1.fixture.fixture.fixture",
    p_history_id: "100",
    p_watch_expiration: new Date(
      Date.now() + 6 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    p_trace_id: traceId,
  });
  if (connected.error) throw connected.error;

  const externalEvent = await admin
    .from("external_event_log")
    .insert({
      source: "dashboard",
      event_type: "privacy_smoke",
      idempotency_key: `privacy-smoke:${runId}`,
      user_id: userId,
      status: "processed",
      payload_hash: "a".repeat(64),
      payload_ref: `temporary:${runId}`,
      trace_id: traceId,
      metadata: {
        fixture: true,
        sensitive_fixture_field: "must_be_removed",
      },
    })
    .select("id")
    .single();
  if (externalEvent.error) throw externalEvent.error;
  externalEventId = externalEvent.data.id;

  const exportResponse = await fetch(`${apiBaseUrl}/api/v1/privacy/export`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  assert(exportResponse.status === 200, "export autenticado responde 200");
  assert(
    exportResponse.headers.get("cache-control") === "private, no-store",
    "export no se cachea",
  );
  const exported = await exportResponse.json();
  const serialized = JSON.stringify(exported);
  assert(
    exported.schema_version === "manzana_user_export_v1",
    "export usa schema versionado",
  );
  assert(
    !/refresh_token|access_token|encrypted_refresh_token/i.test(serialized),
    "export no contiene tokens",
  );

  const deleteResponse = await fetch(
    `${apiBaseUrl}/api/v1/privacy/account`,
    {
      method: "DELETE",
      headers: {
        authorization: `Bearer ${accessToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ confirmation: "ELIMINAR MI CUENTA" }),
    },
  );
  const deleted = await deleteResponse.json();
  assert(deleteResponse.status === 200, "eliminacion autenticada responde 200");
  assert(deleted.data?.deleted === true, "cuenta reporta eliminacion completa");

  const [authAfter, connectionAfter, eventAfter] = await Promise.all([
    admin.auth.admin.getUserById(userId),
    admin
      .from("email_connections")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    admin
      .from("external_event_log")
      .select("user_id,payload_ref,metadata")
      .eq("id", externalEventId)
      .single(),
  ]);
  assert(Boolean(authAfter.error), "usuario Auth fue eliminado");
  if (connectionAfter.error) throw connectionAfter.error;
  assert(connectionAfter.count === 0, "conexion Gmail fue eliminada en cascada");
  if (eventAfter.error) throw eventAfter.error;
  assert(eventAfter.data.user_id === null, "evento tecnico fue anonimizado");
  assert(eventAfter.data.payload_ref === null, "payload_ref temporal fue borrado");
  assert(
    eventAfter.data.metadata.account_deleted === true &&
      eventAfter.data.metadata.sensitive_fixture_field === undefined,
    "metadata externa fue minimizada",
  );
  userId = null;

  console.log(
    JSON.stringify(
      {
        ok: true,
        run_id: runId,
        invariants: {
          authenticated_json_export: true,
          export_excludes_tokens: true,
          gmail_disconnected_before_delete: true,
          auth_user_deleted: true,
          user_data_cascade_deleted: true,
          external_event_minimized: true,
        },
      },
      null,
      2,
    ),
  );
} finally {
  if (userId) {
    await admin.from("external_event_log").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  if (externalEventId) {
    await admin.from("external_event_log").delete().eq("id", externalEventId);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke privacidad fallo: ${message}`);
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
