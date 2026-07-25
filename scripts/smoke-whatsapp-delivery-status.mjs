import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";
import fs from "node:fs";

const BASE_URL = process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3100";
const PASSWORD = "Password123!";

loadEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase local env vars.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const runId = crypto.randomUUID();
const phone = `+519${String(Date.now()).slice(-8)}`;
const providerMessageId = `wamid.smoke.delivery.${runId}`;
const idempotencyKey = `smoke-delivery:${runId}`;
const traces = {
  delivered: crypto.randomUUID(),
  deliveredDuplicate: crypto.randomUUID(),
  read: crypto.randomUUID(),
  staleSent: crypto.randomUUID(),
  failed: crypto.randomUUID(),
};

let userId = null;

try {
  await assertHealth();
  userId = await createSmokeUser();
  await seedDeliveryAttempt();

  const deliveredTimestamp = unixTimestamp();
  const delivered = await postStatusWebhook({
    status: "delivered",
    timestamp: deliveredTimestamp,
    traceId: traces.delivered,
  });

  assertEqual(delivered.data.statuses_received, 1, "delivered received");
  assertEqual(delivered.data.statuses_reconciled, 1, "delivered reconciled");

  let attempt = await requireDeliveryAttempt();
  assertEqual(attempt.status, "accepted", "attempt status after delivered");
  assertEqual(
    attempt.response_summary.latest_delivery_status,
    "delivered",
    "latest delivery after delivered"
  );

  const duplicateDelivered = await postStatusWebhook({
    status: "delivered",
    timestamp: deliveredTimestamp,
    traceId: traces.deliveredDuplicate,
  });

  assertEqual(duplicateDelivered.data.duplicates, 1, "duplicate status count");
  assertEqual(
    duplicateDelivered.data.statuses_reconciled,
    1,
    "duplicate status still reconciles"
  );

  const read = await postStatusWebhook({
    status: "read",
    timestamp: unixTimestamp(1),
    traceId: traces.read,
  });

  assertEqual(read.data.statuses_received, 1, "read received");
  assertEqual(read.data.statuses_reconciled, 1, "read reconciled");

  attempt = await requireDeliveryAttempt();
  assertEqual(
    attempt.response_summary.latest_delivery_status,
    "read",
    "latest delivery after read"
  );

  const staleSent = await postStatusWebhook({
    status: "sent",
    timestamp: unixTimestamp(2),
    traceId: traces.staleSent,
  });

  assertEqual(staleSent.data.statuses_received, 1, "stale sent received");
  assertEqual(staleSent.data.statuses_reconciled, 1, "stale sent reconciled");

  attempt = await requireDeliveryAttempt();
  assertEqual(
    attempt.response_summary.latest_delivery_status,
    "read",
    "out-of-order sent does not regress read"
  );
  assertEqual(
    attempt.metadata.last_delivery_event_status,
    "sent",
    "out-of-order event remains auditable"
  );

  const failed = await postStatusWebhook({
    status: "failed",
    timestamp: unixTimestamp(3),
    traceId: traces.failed,
    errors: [
      {
        code: 131026,
        title: "Message undeliverable",
        message: "Message was not delivered.",
      },
    ],
  });

  assertEqual(failed.data.statuses_received, 1, "failed received");
  assertEqual(failed.data.statuses_reconciled, 1, "failed reconciled");

  attempt = await requireDeliveryAttempt();
  assertEqual(attempt.status, "failed", "attempt status after failed");
  assertEqual(attempt.error_code, "131026", "failed error code");
  assertEqual(
    attempt.response_summary.latest_delivery_status,
    "failed",
    "latest delivery after failed"
  );
  assertEqual(
    attempt.response_summary.delivery_error_count,
    1,
    "failed error count"
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        provider_message_id: providerMessageId,
        delivered: delivered.data,
        duplicate_delivered: duplicateDelivered.data,
        read: read.data,
        stale_sent: staleSent.data,
        failed: failed.data,
        final_attempt: {
          status: attempt.status,
          latest_delivery_status:
            attempt.response_summary.latest_delivery_status,
          error_code: attempt.error_code,
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
    throw new Error(`Manzana app is not healthy at ${BASE_URL}`);
  }
}

async function createSmokeUser() {
  const created = await admin.auth.admin.createUser({
    email: `smoke-whatsapp-delivery-${runId}@example.com`,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { source: "smoke-whatsapp-delivery-status" },
  });

  if (created.error) throw created.error;

  const id = created.data.user.id;
  const { error } = await admin.from("profiles").upsert({
    id,
    display_name: "Smoke WhatsApp Delivery",
    phone_e164: phone,
    timezone: "America/Lima",
    locale: "es-PE",
    onboarding_status: "completed",
  });

  if (error) throw error;
  return id;
}

async function seedDeliveryAttempt() {
  const { error } = await admin.from("whatsapp_delivery_attempts").insert({
    user_id: userId,
    provider: "meta_cloud",
    direction: "outbound",
    message_kind: "freeform",
    to_phone: phone,
    idempotency_key: idempotencyKey,
    trace_id: crypto.randomUUID(),
    provider_message_id: providerMessageId,
    status: "accepted",
    http_status: 200,
    latency_ms: 42,
    request_summary: { provider: "meta_cloud", message_kind: "freeform" },
    response_summary: {
      provider: "meta_cloud",
      provider_message_id: providerMessageId,
    },
    metadata: { source: "smoke-whatsapp-delivery-status" },
  });

  if (error) throw error;
}

async function postStatusWebhook({ status, timestamp, traceId, errors = [] }) {
  return postJson(
    `${BASE_URL}/api/webhooks/whatsapp`,
    buildStatusPayload({ status, timestamp, errors }),
    { "x-trace-id": traceId }
  );
}

function buildStatusPayload({ status, timestamp, errors }) {
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
              statuses: [
                {
                  id: providerMessageId,
                  recipient_id: phone.replace("+", ""),
                  status,
                  timestamp,
                  conversation: { id: `conv_${runId}` },
                  pricing: { category: "utility" },
                  errors,
                },
              ],
            },
          },
        ],
      },
    ],
  };
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

async function requireDeliveryAttempt() {
  const { data, error } = await admin
    .from("whatsapp_delivery_attempts")
    .select("*")
    .eq("user_id", userId)
    .eq("provider_message_id", providerMessageId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Expected whatsapp delivery attempt.");
  return data;
}

function unixTimestamp(addSeconds = 0) {
  return String(Math.floor(Date.now() / 1000) + addSeconds);
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
