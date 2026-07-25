import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = "Password123!";

loadEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerSecret = process.env.WORKER_SECRET ?? process.env.CRON_SECRET;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase local env vars.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = crypto.randomUUID();
const phone = `+519${String(Date.now()).slice(-8)}`;
const traces = [
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
  crypto.randomUUID(),
];

let userId = null;

try {
  await assertHealth();
  userId = await createSmokeUser();

  await sendAndProcess("one", "gaste 8 algo", traces[0]);
  await sendAndProcess("two", "gaste 15 cosa", traces[1]);
  await sendAndProcess("three", "gaste 20 pendiente", traces[2]);

  const listMessageId = messageId("list");
  await postWebhook(listMessageId, "ver pendientes", traces[3]);
  await runWorker();

  const listEvent = await requireExternalEvent(listMessageId);
  const codes = extractCodes(String(listEvent.metadata.response_plan_text));

  assertEqual(codes.length, 3, "listed pending codes");

  const cancelCode = codes[0];
  const confirmCode = codes[1];

  const cancelMessageId = messageId("cancel-code");
  await postWebhook(cancelMessageId, `cancelar ${cancelCode}`, traces[4]);
  await runWorker();

  const cancelEvent = await requireExternalEvent(cancelMessageId);
  assertEqual(
    cancelEvent.metadata.orchestrator_reason,
    "accepted_with_pending_discarded",
    "cancel by code reason"
  );
  assertEqual(
    cancelEvent.metadata.pending_resolution_code,
    cancelCode,
    "cancel code trace"
  );

  let pending = await listRows("pending_items", { user_id: userId });
  let movements = await listRows("movements", { user_id: userId });
  assertEqual(countByStatus(pending, "discarded"), 1, "discarded count");
  assertEqual(countByStatus(pending, "pending"), 2, "active count after cancel");
  assertEqual(movements.length, 0, "movement count after cancel");

  const confirmMessageId = messageId("confirm-code");
  await postWebhook(confirmMessageId, `confirmar ${confirmCode}`, traces[5]);
  await runWorker();

  const confirmEvent = await requireExternalEvent(confirmMessageId);
  assertEqual(
    confirmEvent.metadata.orchestrator_reason,
    "accepted_with_pending_confirmed",
    "confirm by code reason"
  );
  assertEqual(
    confirmEvent.metadata.pending_resolution_code,
    confirmCode,
    "confirm code trace"
  );

  pending = await listRows("pending_items", { user_id: userId });
  movements = await listRows("movements", { user_id: userId });

  assertEqual(countByStatus(pending, "discarded"), 1, "final discarded count");
  assertEqual(countByStatus(pending, "user_confirmed"), 1, "final confirmed count");
  assertEqual(countByStatus(pending, "pending"), 1, "final active count");
  assertEqual(movements.length, 1, "final movement count");

  console.log(
    JSON.stringify(
      {
        ok: true,
        listed_codes: codes,
        cancelled_code: cancelCode,
        confirmed_code: confirmCode,
        pending_statuses: pending.map((item) => item.status),
        movement_count: movements.length,
        cancel_response: cancelEvent.metadata.response_plan_text,
        confirm_response: confirmEvent.metadata.response_plan_text,
      },
      null,
      2
    )
  );
} finally {
  await cleanup();
}

function loadEnv(path) {
  if (!fs.existsSync(path)) return;

  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    process.env[trimmed.slice(0, separator)] ??= trimmed.slice(separator + 1);
  }
}

async function assertHealth() {
  const response = await fetch(`${BASE_URL}/api/health`);
  if (!response.ok) {
    throw new Error(`Manzana app is not healthy at ${BASE_URL}`);
  }
}

async function createSmokeUser() {
  const created = await admin.auth.admin.createUser({
    email: `smoke-whatsapp-pending-codes-${runId}@example.com`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { source: "smoke-whatsapp-pending-codes" },
  });

  if (created.error) throw created.error;

  const id = created.data.user.id;
  const { error } = await admin.from("profiles").upsert({
    id,
    display_name: "Smoke WhatsApp Pending Codes",
    phone_e164: phone,
    timezone: "America/Lima",
    locale: "es-PE",
    onboarding_status: "completed",
  });

  if (error) throw error;
  return id;
}

async function sendAndProcess(suffix, text, traceId) {
  await postWebhook(messageId(suffix), text, traceId);
  await runWorker();
}

function messageId(suffix) {
  return `wamid.smoke.pending-codes.${runId}.${suffix}`;
}

async function postWebhook(id, text, traceId) {
  return postJson(
    `${BASE_URL}/api/webhooks/whatsapp`,
    buildInboundPayload(id, text),
    { "x-trace-id": traceId }
  );
}

function buildInboundPayload(id, text) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_smoke",
        changes: [
          {
            field: "messages",
            value: {
              metadata: {
                display_phone_number: "51 999 888 777",
                phone_number_id: "phone_smoke",
              },
              contacts: [
                {
                  wa_id: phone.replace("+", ""),
                  profile: { name: "Smoke" },
                },
              ],
              messages: [
                {
                  from: phone.replace("+", ""),
                  id,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  text: { body: text },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

async function runWorker() {
  return postJson(
    `${BASE_URL}/api/internal/workers/outbox`,
    { limit: 50 },
    workerSecret ? { authorization: `Bearer ${workerSecret}` } : {}
  );
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  const json = await response.json();

  if (!response.ok) {
    throw new Error(`${url} failed ${response.status}: ${JSON.stringify(json)}`);
  }

  return json;
}

async function requireExternalEvent(id) {
  return requireRow("external_event_log", {
    source: "whatsapp",
    idempotency_key: `meta_cloud:message:${id}`,
  });
}

async function requireRow(table, filters) {
  let query = admin.from(table).select("*");
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Expected row in ${table}: ${JSON.stringify(filters)}`);
  return data;
}

async function listRows(table, filters) {
  let query = admin.from(table).select("*");
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function extractCodes(text) {
  return Array.from(new Set(text.match(/P-[A-F0-9]{8}/g) ?? []));
}

function countByStatus(items, status) {
  return items.filter((item) => item.status === status).length;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function cleanup() {
  for (const traceId of traces) {
    await admin.from("external_event_log").delete().eq("trace_id", traceId);
  }

  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}
