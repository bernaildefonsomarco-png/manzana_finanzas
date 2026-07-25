import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

loadEnv(".env.local");

const BASE_URL = process.env.SMOKE_BASE_URL ?? "https://manzana.website";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET;
const workerSecret = process.env.WORKER_SECRET ?? process.env.CRON_SECRET;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  KAPSO_WEBHOOK_SECRET: webhookSecret,
  WORKER_SECRET: workerSecret,
})) {
  if (!value) throw new Error(`Falta ${name} para el smoke conversacional.`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const reservedSuffix = String(Date.now() % 100).padStart(2, "0");
const phone = `+120255501${reservedSuffix}`;
const email = `smoke-conversation-${runId}@example.com`;
const password = `Smoke-${randomUUID()}-Aa1!`;
const traces = [];
const observations = [];
let userId = null;

try {
  await assertHealth();
  userId = await createSmokeUser();

  const opening = await sendTurn(
    "opening",
    "Hola, hoy quiero ordenar un poco mis gastos",
  );
  assertConversation(opening, "opening");

  const emptyQuery = await sendTurn("empty-query", "Que movimientos hice hoy?");
  assertConversation(emptyQuery, "empty query");
  assertIncludes(
    emptyQuery.metadata.conversation_agent_used_tools,
    "query_movements",
    "empty query tool",
  );

  const mixed = await sendTurn(
    "mixed",
    "Gaste 20 en desayuno y dime como voy esta semana",
  );
  assertEqual(
    mixed.metadata.orchestration_planning_goal,
    "mixed",
    "mixed effective planning goal",
  );
  assertEqual(
    mixed.metadata.financial_action_execution_kind,
    "executed",
    "mixed Core execution",
  );
  assertEqual(
    mixed.metadata.mixed_conversation_status,
    "completed",
    "mixed conversation status",
  );
  assertEqual(
    mixed.metadata.mixed_conversation_provider,
    "api",
    "mixed conversation provider",
  );
  assertSendable(mixed, "mixed");

  const movementsAfterMixed = await listMovements();
  assertEqual(movementsAfterMixed.length, 1, "movement count after mixed turn");
  assertEqual(
    Number(movementsAfterMixed[0].amount),
    20,
    "mixed movement amount",
  );
  assertMatches(
    movementsAfterMixed[0].occurred_at,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    "mixed movement occurred_at",
  );

  const followUp = await sendTurn("follow-up", "Y a que hora fue ese?");
  assertConversation(followUp, "follow-up");
  assertEqual(
    followUp.metadata.conversation_turn_used_active_memory,
    true,
    "follow-up active memory",
  );
  assertConversationEvidence(followUp, "query_movements", "follow-up evidence");
  assertMatches(
    followUp.metadata.response_plan_text,
    /\b(?:[01]?\d|2[0-3]):[0-5]\d\b/,
    "follow-up concrete time",
  );

  const correction = await sendTurn(
    "correction",
    "Descarta el ultimo gasto porfa",
  );
  assertEqual(
    correction.metadata.orchestrator_reason,
    "accepted_with_correction_confirmation",
    "correction proposal reason",
  );
  assertEqual(
    correction.metadata.correction_agent_provider,
    "api",
    "correction provider",
  );
  assertEqual(
    correction.metadata.response_plan_kind,
    "whatsapp_interactive",
    "correction confirmation response",
  );

  const commandId = await requirePendingCorrectionCommand();
  if (!commandId.startsWith("corr:delete:")) {
    throw new Error(`Se esperaba corr:delete, recibido ${commandId}.`);
  }

  const confirmation = await sendTurn("confirm-correction", commandId);
  assertEqual(
    confirmation.metadata.orchestrator_reason,
    "accepted_with_correction_applied",
    "correction applied reason",
  );
  assertSendable(confirmation, "correction confirmation");

  const movementsAfterCorrection = await listMovements();
  assertEqual(
    movementsAfterCorrection.filter((movement) => !movement.deleted_at).length,
    0,
    "active movements after correction",
  );

  const topicShift = await sendTurn(
    "topic-shift",
    "Gracias. Ahora cuanto dinero tengo libre?",
  );
  assertConversation(topicShift, "topic shift");
  assertIncludes(
    topicShift.metadata.conversation_agent_used_tools,
    "get_balance_snapshot",
    "topic shift tool",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        base_url: BASE_URL,
        run_id: runId,
        turns: observations,
        invariants: {
          no_silent_actionable_turns: true,
          api_planning_observed: true,
          api_tool_calling_observed: true,
          mixed_core_then_conversation: true,
          correction_required_confirmation: true,
          correction_applied_only_by_core_command: true,
          active_memory_used: true,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  await printFailureDiagnostics(error);
  throw error;
} finally {
  await cleanup();
}

async function createSmokeUser() {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { source: "smoke-whatsapp-conversation-e2e" },
  });
  if (created.error) throw created.error;

  const id = created.data.user.id;
  const { error } = await admin.from("profiles").upsert({
    id,
    display_name: "Smoke Conversacional",
    phone_e164: phone,
    timezone: "America/Lima",
    locale: "es-PE",
    onboarding_status: "completed",
  });
  if (error) throw error;
  return id;
}

async function sendTurn(label, text) {
  const messageId = `wamid.smoke.conversation.${runId}.${label}`;
  const traceId = randomUUID();
  traces.push(traceId);
  const rawBody = JSON.stringify({
    id: `evt_${runId}_${label}`,
    event: "message.received",
    data: {
      id: messageId,
      phoneNumberId: process.env.KAPSO_PHONE_NUMBER_ID ?? "smoke-phone-id",
      from: phone.replace("+", ""),
      timestamp: String(Math.floor(Date.now() / 1000)),
      type: "text",
      text: { body: text },
    },
  });
  const signature = createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const response = await fetch(`${BASE_URL}/api/webhooks/whatsapp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-webhook-event": "message.received",
      "x-webhook-signature": signature,
      "x-trace-id": traceId,
    },
    body: rawBody,
  });
  const webhook = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `Webhook ${label} fallo ${response.status}: ${JSON.stringify(webhook)}`,
    );
  }
  assertEqual(webhook.data?.inbound_received, 1, `${label} inbound`);
  assertEqual(webhook.data?.handoffs_enqueued, 1, `${label} handoff`);

  const event = await waitForAcceptedEvent(messageId);
  assertSendable(event, label);
  observations.push({
    label,
    orchestrator_reason: event.metadata.orchestrator_reason,
    response_plan_kind: event.metadata.response_plan_kind,
    response_plan_reason: event.metadata.response_plan_reason,
    planning_goal: event.metadata.orchestration_planning_goal ?? null,
    planning_raw_goal: event.metadata.orchestration_planning_raw_goal ?? null,
    planning_reconciled:
      event.metadata.orchestration_planning_reconciled ?? false,
    planning_provider: event.metadata.orchestration_planning_provider ?? null,
    data_provider: event.metadata.agent_runtime_provider ?? null,
    conversation_provider:
      event.metadata.conversation_agent_provider ??
      event.metadata.mixed_conversation_provider ??
      null,
    correction_provider: event.metadata.correction_agent_provider ?? null,
    response_provider: event.metadata.response_agent_provider ?? null,
    response_send_kind: event.metadata.response_send_kind ?? null,
  });
  return event;
}

async function waitForAcceptedEvent(messageId) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    await runWorker();
    const { data, error } = await admin
      .from("external_event_log")
      .select("*")
      .eq("source", "whatsapp")
      .eq("idempotency_key", `kapso:message:${messageId}`)
      .maybeSingle();
    if (error) throw error;
    if (data?.metadata?.orchestrator_status === "accepted") return data;
    await delay(1_000);
  }
  throw new Error(`El evento ${messageId} no fue aceptado dentro del plazo.`);
}

async function runWorker() {
  const response = await fetch(`${BASE_URL}/api/internal/workers/outbox`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${workerSecret}`,
    },
    body: JSON.stringify({ limit: 50 }),
  });
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(
      `Outbox worker fallo ${response.status}: ${JSON.stringify(body)}`,
    );
  }
}

async function requirePendingCorrectionCommand() {
  const { data, error } = await admin
    .from("conversation_memory_states")
    .select("metadata")
    .eq("user_id", userId)
    .eq("channel", "whatsapp")
    .eq("scope", "default")
    .maybeSingle();
  if (error) throw error;
  const ids = data?.metadata?.working_set?.last_action?.command_ids;
  if (!Array.isArray(ids) || typeof ids[0] !== "string") {
    throw new Error("No se persistio el comando de correccion pendiente.");
  }
  return ids[0];
}

async function listMovements() {
  const { data, error } = await admin
    .from("movements")
    .select("id,amount,status,occurred_at,description,deleted_at")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

async function printFailureDiagnostics(error) {
  if (!userId) return;
  const [movements, memory, events] = await Promise.all([
    admin
      .from("movements")
      .select("id,type,amount,occurred_at,description,status,deleted_at")
      .eq("user_id", userId),
    admin
      .from("conversation_memory_states")
      .select(
        "last_intent,last_query_kind,last_query_text,last_tool_name,referenced_movements,metadata,updated_at",
      )
      .eq("user_id", userId)
      .eq("channel", "whatsapp")
      .eq("scope", "default")
      .maybeSingle(),
    admin
      .from("external_event_log")
      .select("id,idempotency_key,received_at,metadata")
      .eq("user_id", userId)
      .order("received_at", { ascending: true }),
  ]);

  console.error(
    JSON.stringify(
      {
        ok: false,
        run_id: runId,
        error: error instanceof Error ? error.message : String(error),
        movements: movements.data ?? [],
        memory: memory.data ?? null,
        events: (events.data ?? []).map((event) => ({
          id: event.id,
          idempotency_key: event.idempotency_key,
          received_at: event.received_at,
          metadata: {
            orchestrator_reason: event.metadata?.orchestrator_reason ?? null,
            response_plan_text: event.metadata?.response_plan_text ?? null,
            orchestration_planning_raw_goal:
              event.metadata?.orchestration_planning_raw_goal ?? null,
            orchestration_planning_goal:
              event.metadata?.orchestration_planning_goal ?? null,
            orchestration_planning_reconciled:
              event.metadata?.orchestration_planning_reconciled ?? null,
            data_agent_intent: event.metadata?.data_agent_intent ?? null,
            data_agent_confidence:
              event.metadata?.data_agent_confidence ?? null,
            data_agent_requires_confirmation:
              event.metadata?.data_agent_requires_confirmation ?? null,
            data_agent_ambiguities:
              event.metadata?.data_agent_ambiguities ?? null,
            financial_action_plan_kind:
              event.metadata?.financial_action_plan_kind ?? null,
            financial_action_plan_actions:
              event.metadata?.financial_action_plan_actions ?? null,
            conversation_agent_used_tools:
              event.metadata?.conversation_agent_used_tools ?? null,
            conversation_agent_runtime_tool_calls:
              event.metadata?.conversation_agent_runtime_tool_calls ?? null,
            conversation_tool_results:
              event.metadata?.conversation_tool_results ?? null,
            mixed_conversation_runtime_tool_calls:
              event.metadata?.mixed_conversation_runtime_tool_calls ?? null,
          },
        })),
      },
      null,
      2,
    ),
  );
}

function assertConversation(event, label) {
  assertEqual(
    event.metadata.orchestrator_reason,
    "accepted_with_conversation_response",
    `${label} conversation reason`,
  );
  assertEqual(
    event.metadata.orchestration_planning_provider,
    "api",
    `${label} planning provider`,
  );
  assertEqual(
    event.metadata.conversation_agent_provider,
    "api",
    `${label} conversation provider`,
  );
}

function assertSendable(event, label) {
  if (
    !["whatsapp_freeform", "whatsapp_interactive"].includes(
      event.metadata.response_plan_kind,
    )
  ) {
    throw new Error(
      `${label} no produjo un plan enviable: ${event.metadata.response_plan_kind}.`,
    );
  }
  if (
    typeof event.metadata.response_plan_text !== "string" ||
    !event.metadata.response_plan_text.trim()
  ) {
    throw new Error(`${label} produjo una respuesta vacia.`);
  }
}

async function assertHealth() {
  const response = await fetch(`${BASE_URL}/api/health`);
  const body = await readJson(response);
  if (!response.ok || body.status !== "ok") {
    throw new Error(
      `Health check fallo: ${response.status} ${JSON.stringify(body)}`,
    );
  }
}

async function cleanup() {
  if (!userId) return;
  await admin.from("external_event_log").delete().eq("user_id", userId);
  await admin.auth.admin.deleteUser(userId);
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

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(
      `${label}: esperado ${JSON.stringify(expected)}, recibido ${JSON.stringify(actual)}.`,
    );
  }
}

function assertIncludes(actual, expected, label) {
  if (!Array.isArray(actual) || !actual.includes(expected)) {
    throw new Error(
      `${label}: no contiene ${expected}; recibido ${JSON.stringify(actual)}.`,
    );
  }
}

function assertConversationEvidence(event, expectedTool, label) {
  const declaredTools = event.metadata.conversation_agent_used_tools;
  const preparedResults = event.metadata.conversation_tool_results;
  const hasDeclaredTool =
    Array.isArray(declaredTools) && declaredTools.includes(expectedTool);
  const hasPreparedTool =
    Array.isArray(preparedResults) &&
    preparedResults.some(
      (result) =>
        result?.tool_name === expectedTool && result?.status === "called",
    );
  const hasActiveMemory =
    event.metadata.conversation_turn_used_active_memory === true;

  if (!hasDeclaredTool && !hasPreparedTool && !hasActiveMemory) {
    throw new Error(
      `${label}: no hubo tool autorizada ni memoria activa trazable; ` +
        `tools=${JSON.stringify(declaredTools)}, results=${JSON.stringify(preparedResults)}.`,
    );
  }
}

function assertMatches(actual, pattern, label) {
  if (typeof actual !== "string" || !pattern.test(actual)) {
    throw new Error(
      `${label}: ${JSON.stringify(actual)} no coincide con ${String(pattern)}.`,
    );
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
