#!/usr/bin/env node
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const RUN_ID = `smoke_rls_${Date.now()}_${Math.random()
  .toString(16)
  .slice(2)}`;
const PASSWORD = "Smoke-RLS-2026!";
const APP_URL_CANDIDATES = process.env.MANZANA_APP_URL
  ? [process.env.MANZANA_APP_URL]
  : ["http://127.0.0.1:3100", "http://127.0.0.1:3000"];

loadEnvFile(".env.local");
loadEnvFile(".env");

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const createdUsers = [];

main()
  .then(() => {
    console.log("");
    console.log("PASS smoke:rls - aislamiento multiusuario verificado");
  })
  .catch((error) => {
    console.error("");
    console.error("FAIL smoke:rls");
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanupUsers();
  });

async function main() {
  console.log(`smoke:rls run_id=${RUN_ID}`);

  const userA = await createConfirmedUser("a");
  const userB = await createConfirmedUser("b");
  const clientA = await signInAs(userA.email);
  const clientB = await signInAs(userB.email);

  const movementA = await seedMovement(userA.id, "Movimiento privado A");
  const movementB = await seedMovement(userB.id, "Movimiento privado B");
  const pendingA = await seedPending(userA.id, "Pendiente privado A");
  const pendingB = await seedPending(userB.id, "Pendiente privado B");

  await expectVisibleById(
    clientA,
    "movements",
    movementA.id,
    "A lee su propio movimiento"
  );
  await expectHiddenById(
    clientB,
    "movements",
    movementA.id,
    "B no lee movimiento de A"
  );
  await expectVisibleById(
    clientB,
    "movements",
    movementB.id,
    "B lee su propio movimiento"
  );

  await expectVisibleById(
    clientA,
    "pending_items",
    pendingA.id,
    "A lee su propio pendiente"
  );
  await expectHiddenById(
    clientB,
    "pending_items",
    pendingA.id,
    "B no lee pendiente de A"
  );
  await expectVisibleById(
    clientB,
    "pending_items",
    pendingB.id,
    "B lee su propio pendiente"
  );

  await expectVisibleById(
    clientA,
    "movement_audit_log",
    movementA.auditLogId,
    "A lee auditoria de su movimiento"
  );
  await expectHiddenById(
    clientB,
    "movement_audit_log",
    movementA.auditLogId,
    "B no lee auditoria de A"
  );

  await expectAuthenticatedWriteBlocked(
    clientA,
    "movements",
    buildMovementDraft(userA.id, "Insert directo bloqueado").movement,
    "usuario autenticado no inserta movimientos directo"
  );
  await expectAuthenticatedWriteBlocked(
    clientB,
    "movements",
    buildMovementDraft(userA.id, "Spoof user_id bloqueado").movement,
    "usuario autenticado no inserta movimiento con user_id ajeno"
  );
  await expectAuthenticatedWriteBlocked(
    clientA,
    "pending_items",
    buildPendingRow(userA.id, "Insert pendiente bloqueado"),
    "usuario autenticado no inserta pendientes directo"
  );

  const apiUrl = await findAvailableApi(clientB.session.access_token);
  if (!apiUrl) {
    console.log(
      "SKIP API - no encontre /api/v1/movements activo en 3100 ni 3000"
    );
    return;
  }

  await assertApiIsolation({
    apiUrl,
    userA,
    userB,
    clientA,
    clientB,
    movementA,
  });
}

async function createConfirmedUser(suffix) {
  const email = `smoke-${RUN_ID}-${suffix}@manzana.local`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: `Smoke ${suffix.toUpperCase()}` },
  });

  if (error || !data.user) {
    throw new Error(`No pude crear usuario ${suffix}: ${error?.message}`);
  }

  createdUsers.push(data.user.id);
  return { id: data.user.id, email };
}

async function signInAs(email) {
  const client = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });

  if (error || !data.session) {
    throw new Error(`No pude iniciar sesion como ${email}: ${error?.message}`);
  }

  return { client, session: data.session };
}

async function seedMovement(userId, description) {
  const draft = buildMovementDraft(userId, description);
  const { data, error } = await admin.rpc("core_commit_movement_create", {
    p_movement: draft.movement,
    p_audit_logs: [draft.auditLog],
    p_account_deltas: [],
    p_box_deltas: [],
    p_outbox_events: [draft.outboxEvent],
  });

  if (error || !data) {
    throw new Error(`No pude sembrar movimiento: ${error?.message}`);
  }

  return { ...data, auditLogId: draft.auditLog.id };
}

async function seedPending(userId, title) {
  const row = buildPendingRow(userId, title);
  const { data, error } = await admin
    .from("pending_items")
    .insert(row)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(`No pude sembrar pendiente: ${error?.message}`);
  }

  return data;
}

function buildMovementDraft(userId, description) {
  const movementId = randomUUID();
  const auditLogId = randomUUID();
  const traceId = randomUUID();
  const movement = {
    id: movementId,
    user_id: userId,
    type: "gasto",
    status: "confirmed",
    amount: 12.5,
    currency: "PEN",
    occurred_at: new Date().toISOString(),
    description,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    source: "dashboard_manual",
    source_ref: null,
    idempotency_key: `${RUN_ID}-${movementId}`,
    confidence: null,
    requires_review: false,
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    related_person_id: null,
    affects_total_balance: false,
    affects_account_balance: false,
    metadata: { smoke: "rls_multiuser", run_id: RUN_ID },
  };

  return {
    movement,
    auditLog: {
      id: auditLogId,
      user_id: userId,
      movement_id: movementId,
      entity_type: "movement",
      entity_id: movementId,
      action: "created",
      field_name: null,
      old_value: null,
      new_value: movement,
      source: "smoke_rls",
      actor_type: "system",
      actor_id: null,
      trace_id: traceId,
      metadata: { run_id: RUN_ID },
    },
    outboxEvent: {
      id: randomUUID(),
      user_id: userId,
      event_type: "movement_created",
      aggregate_type: "movement",
      aggregate_id: movementId,
      payload: { movement_id: movementId, run_id: RUN_ID },
      payload_version: 1,
      trace_id: traceId,
      metadata: { source: "smoke_rls" },
    },
  };
}

function buildPendingRow(userId, title) {
  return {
    user_id: userId,
    type: "email_detected",
    status: "pending",
    source: "email_pending",
    source_ref: `${RUN_ID}-${randomUUID()}`,
    proposed_action: {
      intent: "create_movement",
      movement_type: "gasto",
      amount: 12.5,
      currency: "PEN",
    },
    normalized_summary: {
      title,
      amount: 12.5,
      currency: "PEN",
    },
    risk_level: "low",
    metadata: { smoke: "rls_multiuser", run_id: RUN_ID },
  };
}

async function expectVisibleById(signedIn, table, id, label) {
  const { data, error } = await signedIn.client.from(table).select("*").eq("id", id);
  if (error) throw new Error(`${label}: ${error.message}`);
  assert(data.length === 1, `${label}: esperaba 1 fila, recibi ${data.length}`);
  console.log(`PASS ${label}`);
}

async function expectHiddenById(signedIn, table, id, label) {
  const { data, error } = await signedIn.client.from(table).select("*").eq("id", id);
  if (error) throw new Error(`${label}: ${error.message}`);
  assert(data.length === 0, `${label}: esperaba 0 filas, recibi ${data.length}`);
  console.log(`PASS ${label}`);
}

async function expectAuthenticatedWriteBlocked(signedIn, table, row, label) {
  const { error } = await signedIn.client.from(table).insert(row);
  assert(error, `${label}: la escritura directa fue permitida`);
  console.log(`PASS ${label}`);
}

async function findAvailableApi(accessToken) {
  for (const baseUrl of APP_URL_CANDIDATES) {
    const result = await fetchJson(`${baseUrl}/api/v1/movements?limit=1`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      timeoutMs: 1_500,
    });

    if (
      result.ok &&
      result.json?.ok === true &&
      Array.isArray(result.json?.data?.movements)
    ) {
      return baseUrl;
    }
  }

  return null;
}

async function assertApiIsolation({
  apiUrl,
  userA,
  userB,
  clientA,
  clientB,
  movementA,
}) {
  const before = await fetchJson(`${apiUrl}/api/v1/movements?limit=100`, {
    headers: { Authorization: `Bearer ${clientB.session.access_token}` },
  });
  assert(before.ok && before.json.ok, "API GET de B fallo antes del POST");
  assert(
    !before.json.data.movements.some((movement) => movement.id === movementA.id),
    "API GET de B expuso movimiento de A"
  );
  console.log("PASS API no expone movimiento de A a B");

  const validCreate = await fetchJson(`${apiUrl}/api/v1/movements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clientB.session.access_token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${RUN_ID}-api-valid`,
    },
    body: JSON.stringify({
      type: "gasto",
      amount: 8,
      occurred_at: new Date().toISOString(),
      description: "Movimiento API usuario B",
      metadata: { smoke: "rls_multiuser", run_id: RUN_ID },
    }),
  });

  assert(validCreate.ok && validCreate.json.ok, "API POST valido fallo");
  assert(
    validCreate.json.data.movement.user_id === userB.id,
    "API POST no uso el usuario autenticado B"
  );
  console.log("PASS API crea movimiento con user_id autenticado");

  const invalidCreate = await fetchJson(`${apiUrl}/api/v1/movements`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clientB.session.access_token}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `${RUN_ID}-api-invalid`,
    },
    body: JSON.stringify({
      type: "gasto",
      amount: 8,
      occurred_at: new Date().toISOString(),
      description: "Intento spoof",
      user_id: userA.id,
    }),
  });

  assert(
    invalidCreate.status === 400 &&
      invalidCreate.json?.error?.code === "VALIDATION_ERROR",
    "API permitio o no rechazo limpiamente user_id enviado por cliente"
  );
  console.log("PASS API rechaza user_id enviado por cliente");

  const afterA = await fetchJson(`${apiUrl}/api/v1/movements?limit=100`, {
    headers: { Authorization: `Bearer ${clientA.session.access_token}` },
  });
  const apiMovementId = validCreate.json.data.movement.id;

  assert(afterA.ok && afterA.json.ok, "API GET de A fallo despues del POST");
  assert(
    !afterA.json.data.movements.some((movement) => movement.id === apiMovementId),
    "API GET de A expuso movimiento creado por B"
  );
  console.log("PASS API no expone movimiento de B a A");
}

async function fetchJson(url, init = {}) {
  const { timeoutMs = 3_000, ...fetchInit } = init;
  try {
    const response = await fetch(url, {
      ...fetchInit,
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : null;
    return { ok: response.ok, status: response.status, json };
  } catch {
    return { ok: false, status: 0, json: null };
  }
}

async function cleanupUsers() {
  for (const userId of createdUsers.reverse()) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error(`WARN cleanup user ${userId}: ${error.message}`);
    }
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function loadEnvFile(fileName) {
  const filePath = resolve(fileName);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;

    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Falta variable de entorno ${key}`);
  return value;
}
