import { createClient } from "@supabase/supabase-js";
import { createHmac, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

loadEnv(".env.local");

const BASE_URL = process.env.SMOKE_BASE_URL ?? "https://manzana.website";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const webhookSecret = process.env.KAPSO_WEBHOOK_SECRET;
const workerSecret = process.env.WORKER_SECRET ?? process.env.CRON_SECRET;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  KAPSO_WEBHOOK_SECRET: webhookSecret,
  WORKER_SECRET: workerSecret,
})) {
  if (!value) throw new Error(`Falta ${name} para el smoke de pagos de deuda.`);
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const token = runId.slice(0, 8);
const reservedSuffix = String(Date.now() % 100).padStart(2, "0");
const phone = `+120255501${reservedSuffix}`;
const email = `smoke-whatsapp-debt-${runId}@example.com`;
const password = `Smoke-${randomUUID()}-Aa1!`;
const personName = `Pedro ${token}`;
const primaryDebtName = `Prestamo ${token}`;
const ambiguousDebtName = `Tarjeta ${token}`;
const usdDebtName = `Dolares ${token}`;
const traces = [];
const observations = [];
let userId = null;
let accessToken = null;
let accountId = null;
let primaryDebtId = null;

try {
  await assertHealth();
  await createSmokeUser();
  await createFixtures();

  const initialAccountBalance = await readAccountBalance();
  assertEqual(initialAccountBalance, 200, "saldo inicial de cuenta");

  await assertBlockedWithoutMutation(
    "ambiguous",
    `Pague 10 soles a ${personName}`,
    "debt_reference_ambiguous",
  );
  await clearConversationState();

  await assertBlockedWithoutMutation(
    "overpay",
    `Pague 110 soles de ${primaryDebtName}`,
    "debt_payment_exceeds_balance",
  );
  await clearConversationState();

  await assertBlockedWithoutMutation(
    "currency",
    `Pague 10 soles de ${usdDebtName}`,
    "debt_payment_currency_mismatch",
  );
  await clearConversationState();

  const partial = await sendTurn(
    "partial",
    `Pague 30 soles de la primera cuota de ${primaryDebtName}`,
  );
  assertExecutedDebtPayment(partial, 30, 70, "pago parcial");
  await assertDebtState(primaryDebtId, { balance: 70, status: "due_soon", payments: 1 });
  assertEqual(await readAccountBalance(), 200, "pago sin cuenta no toca saldo");

  const duplicate = await postDuplicate(partial.messageId, partial.text);
  assertEqual(duplicate.data?.duplicates, 1, "evento duplicado detectado");
  assertEqual(duplicate.data?.handoffs_enqueued, 0, "duplicado sin nuevo handoff");
  await assertDebtState(primaryDebtId, { balance: 70, status: "due_soon", payments: 1 });

  const full = await sendTurn(
    "full",
    `Pague los 70 soles restantes de ${primaryDebtName}`,
  );
  assertExecutedDebtPayment(full, 70, 0, "pago completo");
  await assertDebtState(primaryDebtId, { balance: 0, status: "paid", payments: 2 });
  assertEqual(await readAccountBalance(), 200, "liquidacion sin cuenta no toca saldo");

  const outbox = await listDebtOutbox(primaryDebtId);
  assertIncludes(
    outbox.map((event) => event.event_type),
    "debt_payment_registered",
    "outbox de pago",
  );
  assertIncludes(
    outbox.map((event) => event.event_type),
    "debt_paid",
    "outbox de cierre",
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        base_url: BASE_URL,
        run_id: runId,
        deployment_contract: "RecordDebtPaymentCommand",
        primary_debt_id: primaryDebtId,
        observations,
        invariants: {
          whatsapp_partial_payment_executed: true,
          whatsapp_full_payment_executed: true,
          duplicate_event_idempotent: true,
          ambiguous_debt_blocked_without_mutation: true,
          overpayment_blocked_without_mutation: true,
          currency_mismatch_blocked_without_mutation: true,
          null_account_did_not_change_account_balance: true,
          debt_outbox_and_paid_event_present: true,
        },
      },
      null,
      2,
    ),
  );
} catch (error) {
  await printDiagnostics(error);
  throw error;
} finally {
  await cleanup();
}

async function createSmokeUser() {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { source: "smoke-whatsapp-debt-payment" },
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: userId,
    display_name: "Smoke Pago Deuda",
    phone_e164: phone,
    timezone: "America/Lima",
    locale: "es-PE",
    onboarding_status: "completed",
  });
  if (profileError) throw profileError;

  const signedIn = await authClient.auth.signInWithPassword({ email, password });
  if (signedIn.error || !signedIn.data.session) {
    throw signedIn.error ?? new Error("No se pudo iniciar la sesion temporal.");
  }
  accessToken = signedIn.data.session.access_token;
}

async function createFixtures() {
  const account = await apiRequest("/api/v1/accounts", {
    method: "POST",
    body: {
      name: `Cuenta PEN ${token}`,
      type: "digital",
      institution: null,
      currency: "PEN",
      initial_balance: 200,
      is_default: true,
      color: null,
      icon: null,
    },
  });
  accountId = account.data.account.id;
  const dueDate = new Date().toISOString().slice(0, 10);

  const primary = await createDebt({
    name: primaryDebtName,
    person: personName,
    amount: 100,
    currency: "PEN",
    installments: 2,
    installmentAmount: 50,
    dueDate,
  });
  primaryDebtId = primary.data.debt.id;

  await createDebt({
    name: ambiguousDebtName,
    person: personName,
    amount: 60,
    currency: "PEN",
    installments: 1,
    installmentAmount: 60,
    dueDate,
  });

  await createDebt({
    name: usdDebtName,
    person: `Dollar ${token}`,
    amount: 40,
    currency: "USD",
    installments: 1,
    installmentAmount: 40,
    dueDate,
  });
}

function createDebt(params) {
  return apiRequest("/api/v1/debts", {
    method: "POST",
    body: {
      direction: "i_owe",
      kind: "personal",
      name: params.name,
      related_person_name: params.person,
      principal_amount: params.amount,
      currency: params.currency,
      due_date: params.dueDate,
      next_payment_date: params.dueDate,
      installment_count: params.installments,
      installment_amount: params.installmentAmount,
      interest_notes: "Fixture temporal Corte 26",
    },
  });
}

async function sendTurn(label, text) {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const messageId = `wamid.smoke.debt.${runId}.${label}.attempt${attempt}`;
    const traceId = randomUUID();
    const before = await financialSnapshot();
    traces.push(traceId);
    const webhook = await postWebhook(messageId, text, traceId);
    assertEqual(webhook.data?.inbound_received, 1, `${label} inbound`);
    assertEqual(webhook.data?.handoffs_enqueued, 1, `${label} handoff`);
    const event = await waitForAcceptedEvent(messageId);
    const provider = event.metadata.agent_runtime_provider ?? null;
    observations.push({
      label: provider === "api" ? label : `${label}:fallback_${attempt}`,
      trace_id: traceId,
      external_event_id: event.id,
      agent_provider: provider,
      plan_kind: event.metadata.financial_action_plan_kind ?? null,
      execution_kind: event.metadata.financial_action_execution_kind ?? null,
      execution_created_count:
        event.metadata.financial_action_execution_created_count ?? null,
      blocked_reasons:
        event.metadata.financial_action_plan_actions?.flatMap(
          (action) => action.reasons ?? [],
        ) ?? [],
      response_plan_reason: event.metadata.response_plan_reason ?? null,
      response_plan_text: event.metadata.response_plan_text ?? null,
    });
    if (provider === "api") return { event, messageId, text };

    const after = await financialSnapshot();
    assertDeepEqual(after, before, `${label} fallback sin mutacion`);
    await clearConversationState();
    if (attempt < 4) await delay(attempt * 2_000);
  }

  throw new Error(`${label}: AgentRuntime API no estuvo disponible en 4 intentos.`);
}

async function assertBlockedWithoutMutation(label, text, expectedReason) {
  const before = await financialSnapshot();
  const turn = await sendTurn(label, text);
  const metadata = turn.event.metadata;
  assertEqual(metadata.financial_action_plan_kind, "blocked", `${label} plan`);
  assertEqual(
    metadata.financial_action_execution_kind,
    "not_executed",
    `${label} execution`,
  );
  assertEqual(metadata.pending_creation_created_count, 0, `${label} pending`);
  const reasons =
    metadata.financial_action_plan_actions?.flatMap(
      (action) => action.reasons ?? [],
    ) ?? [];
  assertIncludes(reasons, expectedReason, `${label} reason`);
  const after = await financialSnapshot();
  assertDeepEqual(after, before, `${label} no mutation`);
}

function assertExecutedDebtPayment(turn, amount, remainingBalance, label) {
  const metadata = turn.event.metadata;
  assertEqual(metadata.financial_action_plan_kind, "ready_for_core", `${label} plan`);
  assertEqual(metadata.financial_action_execution_kind, "executed", `${label} execution`);
  assertEqual(
    metadata.financial_action_execution_created_count,
    1,
    `${label} created count`,
  );
  const movement = metadata.financial_action_execution_movements?.[0];
  if (!movement) throw new Error(`${label}: falta movimiento ejecutado.`);
  assertEqual(movement.movement_type, "pago_deuda", `${label} movement type`);
  assertEqual(Number(movement.amount), amount, `${label} amount`);
  assertEqual(
    Number(movement.debt_remaining_balance),
    remainingBalance,
    `${label} remaining balance`,
  );
}

async function postDuplicate(messageId, text) {
  return postWebhook(messageId, text, randomUUID());
}

async function postWebhook(messageId, text, traceId) {
  const rawBody = JSON.stringify({
    id: `evt_${messageId}`,
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
  const body = await readJson(response);
  if (!response.ok) {
    throw new Error(`Webhook fallo ${response.status}: ${JSON.stringify(body)}`);
  }
  return body;
}

async function waitForAcceptedEvent(messageId) {
  for (let attempt = 0; attempt < 18; attempt += 1) {
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
    throw new Error(`Worker fallo ${response.status}: ${JSON.stringify(body)}`);
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.idempotencyKey
        ? { "idempotency-key": options.idempotencyKey }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const body = await readJson(response);
  if (!response.ok || !body.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} fallo ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return body;
}

async function financialSnapshot() {
  const [debts, movements, payments, accountBalance] = await Promise.all([
    admin
      .from("debts")
      .select("id,current_balance,status")
      .eq("user_id", userId)
      .order("id"),
    admin
      .from("movements")
      .select("id,type,amount,debt_id")
      .eq("user_id", userId)
      .order("id"),
    admin
      .from("debt_payments")
      .select("id,debt_id,amount,movement_id")
      .eq("user_id", userId)
      .order("id"),
    readAccountBalance(),
  ]);
  if (debts.error) throw debts.error;
  if (movements.error) throw movements.error;
  if (payments.error) throw payments.error;
  return {
    debts: debts.data ?? [],
    movements: movements.data ?? [],
    payments: payments.data ?? [],
    account_balance: accountBalance,
  };
}

async function assertDebtState(debtId, expected) {
  const [{ data: debt, error: debtError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      admin
        .from("debts")
        .select("current_balance,status")
        .eq("user_id", userId)
        .eq("id", debtId)
        .single(),
      admin
        .from("debt_payments")
        .select("id")
        .eq("user_id", userId)
        .eq("debt_id", debtId),
    ]);
  if (debtError) throw debtError;
  if (paymentsError) throw paymentsError;
  assertEqual(Number(debt.current_balance), expected.balance, "saldo de deuda");
  assertEqual(debt.status, expected.status, "estado de deuda");
  assertEqual(payments.length, expected.payments, "cantidad de pagos");
}

async function readAccountBalance() {
  const { data, error } = await admin
    .from("accounts")
    .select("current_balance")
    .eq("user_id", userId)
    .eq("id", accountId)
    .single();
  if (error) throw error;
  return Number(data.current_balance);
}

async function listDebtOutbox(debtId) {
  const { data, error } = await admin
    .from("transactional_outbox")
    .select("id,event_type,status,aggregate_id")
    .eq("user_id", userId)
    .eq("aggregate_type", "debt")
    .eq("aggregate_id", debtId);
  if (error) throw error;
  return data ?? [];
}

async function clearConversationState() {
  const { error } = await admin
    .from("conversation_memory_states")
    .delete()
    .eq("user_id", userId)
    .eq("channel", "whatsapp");
  if (error) throw error;
}

async function assertHealth() {
  const response = await fetch(`${BASE_URL}/api/health`);
  const body = await readJson(response);
  if (!response.ok || body.status !== "ok" || body.checks?.supabase?.status !== "ok") {
    throw new Error(`Health invalido: ${response.status} ${JSON.stringify(body)}`);
  }
}

async function printDiagnostics(error) {
  if (!userId) return;
  const [snapshot, events] = await Promise.all([
    financialSnapshot().catch(() => null),
    admin
      .from("external_event_log")
      .select("id,idempotency_key,trace_id,metadata")
      .eq("user_id", userId)
      .order("received_at"),
  ]);
  console.error(
    JSON.stringify(
      {
        ok: false,
        run_id: runId,
        error: error instanceof Error ? error.message : String(error),
        snapshot,
        observations,
        events: (events.data ?? []).map((event) => ({
          id: event.id,
          idempotency_key: event.idempotency_key,
          trace_id: event.trace_id,
          metadata: {
            orchestrator_reason: event.metadata?.orchestrator_reason ?? null,
            agent_runtime_provider: event.metadata?.agent_runtime_provider ?? null,
            data_agent_intent: event.metadata?.data_agent_intent ?? null,
            data_agent_confidence: event.metadata?.data_agent_confidence ?? null,
            data_agent_requires_confirmation:
              event.metadata?.data_agent_requires_confirmation ?? null,
            data_agent_ambiguities: event.metadata?.data_agent_ambiguities ?? null,
            financial_action_plan_kind:
              event.metadata?.financial_action_plan_kind ?? null,
            financial_action_plan_actions:
              event.metadata?.financial_action_plan_actions ?? null,
            financial_action_execution_kind:
              event.metadata?.financial_action_execution_kind ?? null,
            financial_action_execution_movements:
              event.metadata?.financial_action_execution_movements ?? null,
            pending_creation_created_count:
              event.metadata?.pending_creation_created_count ?? null,
            response_plan_text: event.metadata?.response_plan_text ?? null,
          },
        })),
      },
      null,
      2,
    ),
  );
}

async function cleanup() {
  if (!userId) return;
  await admin.from("external_event_log").delete().eq("user_id", userId);
  const deleted = await admin.auth.admin.deleteUser(userId);
  if (deleted.error) {
    console.error(`No se pudo eliminar el usuario temporal: ${deleted.error.message}`);
    process.exitCode = 1;
  }
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
      `${label}: falta ${expected}; recibido ${JSON.stringify(actual)}.`,
    );
  }
}

function assertDeepEqual(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${label}: cambio inesperado. antes=${JSON.stringify(expected)} despues=${JSON.stringify(actual)}.`,
    );
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
