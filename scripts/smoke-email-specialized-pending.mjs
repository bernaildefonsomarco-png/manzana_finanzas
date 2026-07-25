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
  throw new Error("Faltan credenciales Supabase para el smoke especializado.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const userEmail = `email-specialized-${runId}@example.invalid`;
const gmailAddress = `email-specialized-gmail-${runId}@example.invalid`;
const sender = `alerts-${runId}@bank.example`;
const password = `Smoke-${randomUUID()}-Aa1!`;
const institutionKey = `specialized_${runId.slice(0, 8)}`;
let userId = null;
let templateId = null;
let sourceId = null;

try {
  const created = await admin.auth.admin.createUser({
    email: userEmail,
    password,
    email_confirm: true,
  });
  if (created.error || !created.data.user) {
    throw created.error ?? new Error("No se creo usuario especializado");
  }
  userId = created.data.user.id;
  const signedIn = await authClient.auth.signInWithPassword({
    email: userEmail,
    password,
  });
  if (signedIn.error || !signedIn.data.session) {
    throw signedIn.error ?? new Error("No se obtuvo sesion especializada");
  }
  const accessToken = signedIn.data.session.access_token;
  const traceId = randomUUID();

  const institution = await admin
    .from("email_institutions")
    .insert({
      institution_key: institutionKey,
      display_name: "Banco fixture especializado",
      aliases: ["Banco fixture"],
      enabled: true,
      sort_order: 9999,
      metadata: { fixture: true, run_id: runId },
    });
  if (institution.error) throw institution.error;

  const template = await admin
    .from("email_parse_templates")
    .insert({
      institution_key: institutionKey,
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
        subject_patterns: ["Smoke especializado"],
        extraction_rules: {
          amount: { pattern: "S/\\s*([\\d.,]+)", type: "number" },
          direction: "out",
          currency: "PEN",
        },
        allow_generic_fallback: false,
        confidence: { template: 0.95, fallback: 0.5 },
      },
      metadata: {
        fixture: true,
        run_id: runId,
        sender_authentication: "dkim_dmarc_required",
        shadow_reviewed: true,
        critical_error_count: 0,
        rollback_ready: true,
        grounding_rate: 1,
        fallback_rate: 0,
        evidence_repair_rate: 0,
        value_normalization_rate: 0,
      },
    })
    .select("id")
    .single();
  if (template.error) throw template.error;
  templateId = template.data.id;

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

  const source = await admin
    .from("user_email_sources")
    .insert({
      user_id: userId,
      institution_key: institutionKey,
      email_connection_id: connected.data.id,
      notification_sender: sender,
      status: "active",
      verification_status: "verified",
      verified_at: new Date().toISOString(),
      metadata: { fixture: true, run_id: runId },
    })
    .select("id")
    .single();
  if (source.error) throw source.error;
  sourceId = source.data.id;

  const originAccount = (
    await apiRequest("/api/v1/accounts", accessToken, {
      method: "POST",
      body: {
        name: "Cuenta origen smoke",
        type: "digital",
        institution: "Banco fixture",
        currency: "PEN",
        initial_balance: 200,
        is_default: true,
        color: null,
        icon: null,
      },
    })
  ).data.account;
  const destinationAccount = (
    await apiRequest("/api/v1/accounts", accessToken, {
      method: "POST",
      body: {
        name: "Cuenta destino smoke",
        type: "digital",
        institution: "Banco fixture",
        currency: "PEN",
        initial_balance: 10,
        is_default: false,
        color: null,
        icon: null,
      },
    })
  ).data.account;

  const today = new Date().toISOString().slice(0, 10);
  const debt = (
    await apiRequest("/api/v1/debts", accessToken, {
      method: "POST",
      body: {
        direction: "i_owe",
        kind: "personal",
        name: "Deuda email smoke",
        related_person_name: null,
        principal_amount: 100,
        currency: "PEN",
        due_date: today,
        next_payment_date: today,
        installment_count: null,
        installment_amount: null,
        interest_notes: "Fixture sintetico autorizado.",
      },
    })
  ).data.debt;

  const debtPendingId = await createEmailPending({
    connectionId: connected.data.id,
    suffix: "debt",
    hashCharacter: "d",
    amount: 30,
    title: "Pago de deuda email",
    action: {
      action: "record_debt_payment",
      movement_type: "pago_deuda",
      debt_id: debt.id,
      amount: 30,
      currency: "PEN",
      account_id: originAccount.id,
      paid_at: new Date().toISOString(),
      movement_input: movementInput({
        type: "pago_deuda",
        amount: 30,
        accountOriginId: originAccount.id,
        debtId: debt.id,
        sourceRef: `gmail:debt-${runId}`,
      }),
    },
  });
  const debtConfirmation = await confirmPending(debtPendingId, accessToken);
  assert(
    debtConfirmation.data.movement.type === "pago_deuda",
    "deuda usa movimiento especializado",
  );
  const debtRetry = await confirmPending(debtPendingId, accessToken);
  assert(debtRetry.data.idempotent === true, "retry de deuda es idempotente");

  const recurringRule = (
    await apiRequest("/api/v1/recurring", accessToken, {
      method: "POST",
      body: {
        name: "Suscripcion email smoke",
        expected_amount: 25,
        amount_variability: "fixed",
        currency: "PEN",
        frequency: "monthly",
        next_expected_date: today,
        category_id: "servicios_suscripciones",
        default_account_id: originAccount.id,
      },
    })
  ).data.recurring_rule;
  const occurrence = await admin
    .from("recurring_occurrences")
    .select("id")
    .eq("user_id", userId)
    .eq("recurring_rule_id", recurringRule.id)
    .single();
  if (occurrence.error) throw occurrence.error;

  const recurringPendingId = await createEmailPending({
    connectionId: connected.data.id,
    suffix: "recurring",
    hashCharacter: "e",
    amount: 25,
    title: "Pago recurrente email",
    action: {
      action: "record_recurring_payment",
      movement_type: "pago_recurrente",
      recurring_rule_id: recurringRule.id,
      recurring_occurrence_id: occurrence.data.id,
      amount: 25,
      currency: "PEN",
      account_id: originAccount.id,
      paid_at: new Date().toISOString(),
      movement_input: movementInput({
        type: "pago_recurrente",
        amount: 25,
        accountOriginId: originAccount.id,
        recurringRuleId: recurringRule.id,
        recurringOccurrenceId: occurrence.data.id,
        sourceRef: `gmail:recurring-${runId}`,
      }),
    },
  });
  const recurringConfirmation = await confirmPending(
    recurringPendingId,
    accessToken,
  );
  assert(
    recurringConfirmation.data.movement.type === "pago_recurrente",
    "recurrente usa movimiento especializado",
  );

  const transferPendingId = await createEmailPending({
    connectionId: connected.data.id,
    suffix: "transfer",
    hashCharacter: "f",
    amount: 20,
    title: "Transferencia entre cuentas email",
    action: {
      action: "record_transfer",
      movement_type: "transferencia",
      account_origin_id: originAccount.id,
      account_destination_id: destinationAccount.id,
      amount: 20,
      currency: "PEN",
      occurred_at: new Date().toISOString(),
      movement_input: movementInput({
        type: "transferencia",
        amount: 20,
        accountOriginId: originAccount.id,
        accountDestinationId: destinationAccount.id,
        sourceRef: `gmail:transfer-${runId}`,
      }),
    },
  });
  const transferConfirmation = await confirmPending(
    transferPendingId,
    accessToken,
  );
  assert(
    transferConfirmation.data.movement.type === "transferencia",
    "transferencia usa validacion dedicada",
  );

  const [debtAfter, occurrenceAfter, accountsAfter, pendingAfter, movements] =
    await Promise.all([
      admin
        .from("debts")
        .select("current_balance")
        .eq("id", debt.id)
        .single(),
      admin
        .from("recurring_occurrences")
        .select("status,paid_movement_id")
        .eq("id", occurrence.data.id)
        .single(),
      admin
        .from("accounts")
        .select("id,current_balance")
        .eq("user_id", userId),
      admin
        .from("pending_items")
        .select("id,status,metadata")
        .in("id", [debtPendingId, recurringPendingId, transferPendingId]),
      admin
        .from("movements")
        .select("id,type")
        .eq("user_id", userId),
    ]);
  for (const result of [
    debtAfter,
    occurrenceAfter,
    accountsAfter,
    pendingAfter,
    movements,
  ]) {
    if (result.error) throw result.error;
  }

  const originAfter = accountsAfter.data.find(
    (account) => account.id === originAccount.id,
  );
  const destinationAfter = accountsAfter.data.find(
    (account) => account.id === destinationAccount.id,
  );
  assert(debtAfter.data.current_balance === 70, "deuda queda en saldo 70");
  assert(
    occurrenceAfter.data.status === "paid" &&
      Boolean(occurrenceAfter.data.paid_movement_id),
    "ocurrencia recurrente queda pagada",
  );
  assert(originAfter?.current_balance === 125, "cuenta origen queda en 125");
  assert(destinationAfter?.current_balance === 30, "cuenta destino queda en 30");
  assert(
    pendingAfter.data.length === 3 &&
      pendingAfter.data.every(
        (item) =>
          item.status === "user_confirmed" &&
          typeof item.metadata.confirmed_movement_id === "string",
      ),
    "los tres pendientes quedan confirmados",
  );
  assert(movements.data.length === 3, "se crean exactamente tres movimientos");

  console.log(
    JSON.stringify(
      {
        ok: true,
        run_id: runId,
        invariants: {
          debt_payment_atomic: true,
          debt_payment_retry_idempotent: true,
          recurring_payment_atomic: true,
          transfer_validated_by_dedicated_branch: true,
          pending_and_outcome_committed_together: true,
          movement_count: movements.data.length,
          final_origin_balance: originAfter.current_balance,
          final_destination_balance: destinationAfter.current_balance,
          final_debt_balance: debtAfter.data.current_balance,
        },
      },
      null,
      2,
    ),
  );
} finally {
  if (templateId) {
    await admin.from("email_parse_templates").delete().eq("id", templateId);
  }
  if (userId) {
    await admin.from("external_event_log").delete().eq("user_id", userId);
    await admin.auth.admin.deleteUser(userId);
  }
  await admin
    .from("email_institutions")
    .delete()
    .eq("institution_key", institutionKey)
    .eq("metadata->>fixture", "true");
}

async function createEmailPending(input) {
  const occurredAt = new Date().toISOString();
  const result = await admin.rpc("commit_email_message_outcome", {
    p_user_id: userId,
    p_connection_id: input.connectionId,
    p_provider_message_id: `gmail-${input.suffix}-${runId}`,
    p_provider_thread_id: `thread-${input.suffix}-${runId}`,
    p_received_at: occurredAt,
    p_sender: sender,
    p_subject_hash: input.hashCharacter.repeat(64),
    p_content_hash: input.hashCharacter.repeat(64),
    p_parsed_status: "parsed",
    p_pending: {
      proposed_action: input.action,
      normalized_summary: {
        title: input.title,
        amount: input.amount,
        currency: "PEN",
        occurred_at: occurredAt,
      },
      dedup_status: "unique",
      risk_level: "low",
      metadata: {
        fixture: true,
        template_id: templateId,
        email_source_id: sourceId,
        content_persisted: false,
      },
    },
    p_metadata: {
      fixture: true,
      template_id: templateId,
      email_source_id: sourceId,
      institution_key: institutionKey,
      parse_mode: "template",
      entry_surface: "gmail_history",
      processing_latency_ms: 10,
      content_persisted: false,
    },
    p_trace_id: randomUUID(),
  });
  if (result.error) throw result.error;
  assert(Boolean(result.data.pending_item_id), `${input.suffix} crea pendiente`);
  return result.data.pending_item_id;
}

function movementInput(input) {
  return {
    type: input.type,
    amount: input.amount,
    currency: "PEN",
    occurred_at: new Date().toISOString(),
    description: `Movimiento ${input.type} fixture`,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    account_origin_id: input.accountOriginId ?? null,
    account_destination_id: input.accountDestinationId ?? null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: input.debtId ?? null,
    recurring_rule_id: input.recurringRuleId ?? null,
    recurring_occurrence_id: input.recurringOccurrenceId ?? null,
    source: "email_confirmed",
    source_ref: input.sourceRef,
    confidence: 0.95,
    requires_review: true,
    metadata: { fixture: true, specialized_engine_required: true },
  };
}

async function confirmPending(pendingId, accessToken) {
  return apiRequest(`/api/v1/pending/${pendingId}/confirm`, accessToken, {
    method: "POST",
    body: { confirm_duplicate: false },
  });
}

async function apiRequest(path, accessToken, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "content-type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} fallo ${response.status}: ${JSON.stringify(payload)}`,
    );
  }
  return payload;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Smoke email especializado fallo: ${message}`);
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
