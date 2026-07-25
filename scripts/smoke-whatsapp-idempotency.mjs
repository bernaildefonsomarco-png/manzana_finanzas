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
const email = `smoke-whatsapp-idempotency-${runId}@example.com`;
const traces = {
  register: crypto.randomUUID(),
  registerDuplicate: crypto.randomUUID(),
  confirm: crypto.randomUUID(),
  confirmDuplicate: crypto.randomUUID(),
  confirmLateDuplicate: crypto.randomUUID(),
};

let userId = null;

try {
  await assertHealth();
  userId = await createSmokeUser();

  const registerMessageId = `wamid.smoke.idempotency.${runId}.register`;
  const confirmMessageId = `wamid.smoke.idempotency.${runId}.confirm`;

  const firstRegister = await postWebhook(
    registerMessageId,
    "gaste 8 algo",
    traces.register
  );
  const duplicateRegister = await postWebhook(
    registerMessageId,
    "gaste 8 algo",
    traces.registerDuplicate
  );

  assertEqual(firstRegister.data.inbound_received, 1, "first register inbound");
  assertEqual(firstRegister.data.handoffs_enqueued, 1, "first register handoff");
  assertEqual(
    duplicateRegister.data.duplicates,
    1,
    "duplicate register duplicate count"
  );
  assertEqual(
    duplicateRegister.data.handoffs_enqueued,
    0,
    "duplicate register handoff"
  );

  await runWorker();
  await runWorker();

  const registerEvent = await requireExternalEvent(registerMessageId);
  const registerOutbox = await listRows("transactional_outbox", {
    aggregate_id: registerEvent.id,
    event_type: "whatsapp.message_received",
  });
  const pendingAfterRegister = await listRows("pending_items", {
    user_id: userId,
  });

  assertEqual(registerOutbox.length, 1, "register handoff outbox rows");
  assertEqual(pendingAfterRegister.length, 1, "pending count after retry");
  assertEqual(pendingAfterRegister[0].status, "pending", "pending status");

  const firstConfirm = await postWebhook(
    confirmMessageId,
    "confirmo",
    traces.confirm
  );
  const duplicateConfirm = await postWebhook(
    confirmMessageId,
    "confirmo",
    traces.confirmDuplicate
  );

  assertEqual(firstConfirm.data.inbound_received, 1, "first confirm inbound");
  assertEqual(firstConfirm.data.handoffs_enqueued, 1, "first confirm handoff");
  assertEqual(
    duplicateConfirm.data.duplicates,
    1,
    "duplicate confirm duplicate count"
  );
  assertEqual(
    duplicateConfirm.data.handoffs_enqueued,
    0,
    "duplicate confirm handoff"
  );

  await runWorker();
  await runWorker();

  const confirmEvent = await requireExternalEvent(confirmMessageId);
  const confirmOutbox = await listRows("transactional_outbox", {
    aggregate_id: confirmEvent.id,
    event_type: "whatsapp.message_received",
  });
  const pendingAfterConfirm = await requireRow("pending_items", {
    id: pendingAfterRegister[0].id,
  });
  const movementsAfterConfirm = await listRows("movements", {
    user_id: userId,
  });

  assertEqual(confirmOutbox.length, 1, "confirm handoff outbox rows");
  assertEqual(
    pendingAfterConfirm.status,
    "user_confirmed",
    "pending confirmed once"
  );
  assertEqual(movementsAfterConfirm.length, 1, "movement count after confirm");
  assertEqual(
    confirmEvent.metadata.orchestrator_reason,
    "accepted_with_pending_confirmed",
    "confirm orchestrator reason"
  );

  const lateDuplicateConfirm = await postWebhook(
    confirmMessageId,
    "confirmo",
    traces.confirmLateDuplicate
  );
  assertEqual(
    lateDuplicateConfirm.data.duplicates,
    1,
    "late duplicate confirm duplicate count"
  );
  assertEqual(
    lateDuplicateConfirm.data.handoffs_enqueued,
    0,
    "late duplicate confirm handoff"
  );

  await runWorker();

  const movementsAfterLateDuplicate = await listRows("movements", {
    user_id: userId,
  });
  const pendingAfterLateDuplicate = await requireRow("pending_items", {
    id: pendingAfterRegister[0].id,
  });

  assertEqual(
    movementsAfterLateDuplicate.length,
    1,
    "movement count after late duplicate"
  );
  assertEqual(
    pendingAfterLateDuplicate.status,
    "user_confirmed",
    "pending status after late duplicate"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        register: {
          first: firstRegister.data,
          duplicate: duplicateRegister.data,
          external_event_id: registerEvent.id,
          handoff_outbox_rows: registerOutbox.length,
          pending_count: pendingAfterRegister.length,
        },
        confirm: {
          first: firstConfirm.data,
          duplicate: duplicateConfirm.data,
          late_duplicate: lateDuplicateConfirm.data,
          external_event_id: confirmEvent.id,
          handoff_outbox_rows: confirmOutbox.length,
          movement_count: movementsAfterLateDuplicate.length,
          pending_status: pendingAfterLateDuplicate.status,
          response_plan_text: confirmEvent.metadata.response_plan_text,
          response_send_reason: confirmEvent.metadata.response_send_reason,
        },
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
    throw new Error(
      `Manzana app is not healthy at ${BASE_URL}: ${response.status}`
    );
  }
}

async function createSmokeUser() {
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { source: "smoke-whatsapp-idempotency" },
  });

  if (created.error) throw created.error;

  const id = created.data.user.id;
  const { error } = await admin.from("profiles").upsert({
    id,
    display_name: "Smoke WhatsApp Idempotency",
    phone_e164: phone,
    timezone: "America/Lima",
    locale: "es-PE",
    onboarding_status: "completed",
  });

  if (error) throw error;
  return id;
}

async function postWebhook(messageId, text, traceId) {
  return postJson(
    `${BASE_URL}/api/webhooks/whatsapp`,
    buildInboundPayload(messageId, text),
    { "x-trace-id": traceId }
  );
}

function buildInboundPayload(messageId, text) {
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
                  id: messageId,
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

async function requireExternalEvent(messageId) {
  const event = await requireRow("external_event_log", {
    source: "whatsapp",
    idempotency_key: `meta_cloud:message:${messageId}`,
  });

  const duplicates = await listRows("external_event_log", {
    source: "whatsapp",
    idempotency_key: `meta_cloud:message:${messageId}`,
  });
  assertEqual(duplicates.length, 1, `external events for ${messageId}`);

  return event;
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

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, got ${actual}`);
  }
}

async function cleanup() {
  for (const traceId of Object.values(traces)) {
    await admin.from("external_event_log").delete().eq("trace_id", traceId);
  }

  if (userId) {
    await admin.auth.admin.deleteUser(userId);
  }
}
