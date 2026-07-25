import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { confirmPendingItemWithCore } from "@/core/pending/confirm-pending";
import { buildPendingItemWhatsAppCode } from "@/core/pending/whatsapp-pending-code";
import { resolvePendingFromWhatsAppAction } from "@/core/orchestrator/whatsapp-pending-confirmation";
import type { Database } from "@/data/supabase/types";
import type { PendingItem } from "@/shared/types/domain";

loadEnvConfig(process.cwd());

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  requireEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const apiBaseUrl =
  process.env.SMOKE_API_BASE_URL?.trim() || "https://manzana.website";
const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const authClient = createClient<Database>(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const userEmail = `email-conversation-${runId}@example.invalid`;
const gmailAddress = `email-conversation-gmail-${runId}@example.invalid`;
const sender = `alerts-${runId}@bank.example`;
const password = `Smoke-${randomUUID()}-Aa1!`;
const institutionKey = `conversation_${runId.slice(0, 8)}`;
let userId: string | null = null;
let templateId: string | null = null;
let sourceId: string | null = null;
let connectionId: string | null = null;

void main();

async function main(): Promise<void> {
  try {
    const created = await admin.auth.admin.createUser({
      email: userEmail,
      password,
      email_confirm: true,
    });
    if (created.error || !created.data.user) {
      throw created.error ?? new Error("No se creo el usuario fixture.");
    }
    userId = created.data.user.id;
    const signedIn = await authClient.auth.signInWithPassword({
      email: userEmail,
      password,
    });
    if (signedIn.error || !signedIn.data.session) {
      throw signedIn.error ?? new Error("No se obtuvo sesion fixture.");
    }
    const accessToken = signedIn.data.session.access_token;
    await createEmailSourceFixture();

    const origin = (
      await apiRequest("/api/v1/accounts", accessToken, {
        method: "POST",
        body: {
          name: "Mi cuenta principal",
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
    const destination = (
      await apiRequest("/api/v1/accounts", accessToken, {
        method: "POST",
        body: {
          name: "Mi bolsillo diario",
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

    const transferPending = await createEmailPending({
      suffix: "transfer",
      amount: 20,
      title: "Transferencia entre mis cuentas",
      originHint: "Clásica ****3087",
      destinationHint: "Clásica ****9039",
    });
    const transferCode = buildPendingItemWhatsAppCode(transferPending);
    const transferEdit = await resolvePendingFromWhatsAppAction({
      client: admin,
      userId,
      action: "assign_transfer",
      pendingCode: transferCode,
      accountOriginId: origin.id,
      accountDestinationId: destination.id,
      learnAccountAliases: true,
      userText:
        "Recuerda que la 3087 es Mi cuenta principal y la 9039 es Mi bolsillo diario",
      traceId: randomUUID(),
    });
    assert(
      transferEdit.kind === "updated" &&
        transferEdit.ready_for_confirmation,
      "la seleccion conversacional deja la transferencia lista",
    );
    const transferConfirmation = await resolvePendingFromWhatsAppAction({
      client: admin,
      userId,
      action: "confirm",
      pendingCode: transferCode,
      userText: `confirmar ${transferCode}`,
      traceId: randomUUID(),
    });
    assert(
      transferConfirmation.kind === "confirmed" &&
        transferConfirmation.movement.type === "transferencia",
      "Core confirma la transferencia editada",
    );
    const transferRetry = await confirmPendingItemWithCore({
      client: admin,
      userId,
      pendingItemId: transferPending.id,
      actor: { type: "user", id: userId },
      source: "smoke.email.conversation.retry",
      traceId: randomUUID(),
    });
    assert(transferRetry.idempotent, "el retry de transferencia es idempotente");
    const balancesAfterTransfer = await readBalances(userId);
    assert(
      balancesAfterTransfer.get(origin.id) === 180 &&
        balancesAfterTransfer.get(destination.id) === 30,
      "la transferencia aplica exactamente ambos saldos",
    );

    const learnedOrigin = await requireAccount(origin.id);
    const learnedDestination = await requireAccount(destination.id);
    assert(
      readStringArray(
        toRecord(learnedOrigin.metadata).email_account_hints,
      ).includes("Clásica ****3087") &&
        readStringArray(
          toRecord(learnedDestination.metadata).email_account_hints,
        ).includes("Clásica ****9039"),
      "los alias explicitos quedan auditables",
    );

    const expensePending = await createEmailPending({
      suffix: "yape",
      amount: 10,
      title: "Pago con Yape",
      originHint: "Cuenta de ahorro ****5019",
      destinationHint: "Yape",
    });
    const expenseCode = buildPendingItemWhatsAppCode(expensePending);
    const expenseEdit = await resolvePendingFromWhatsAppAction({
      client: admin,
      userId,
      action: "classify_expense",
      pendingCode: expenseCode,
      accountOriginId: null,
      categoryId: "otros",
      userText: `${expenseCode} fue un gasto sin cuenta`,
      traceId: randomUUID(),
    });
    assert(
      expenseEdit.kind === "updated" &&
        expenseEdit.ready_for_confirmation &&
        expenseEdit.pending_item.proposed_action.movement_type === "gasto",
      "Yape externo se reclasifica sin crear cuenta",
    );
    const expenseConfirmation = await resolvePendingFromWhatsAppAction({
      client: admin,
      userId,
      action: "confirm",
      pendingCode: expenseCode,
      userText: `confirmar ${expenseCode}`,
      traceId: randomUUID(),
    });
    assert(
      expenseConfirmation.kind === "confirmed" &&
        expenseConfirmation.movement.type === "gasto" &&
        expenseConfirmation.movement.account_origin_id === null,
      "Core registra el gasto sin cuenta",
    );
    const balancesAfterExpense = await readBalances(userId);
    assert(
      JSON.stringify([...balancesAfterExpense]) ===
        JSON.stringify([...balancesAfterTransfer]),
      "el gasto sin cuenta no altera saldos de cuentas",
    );

    const discardedPending = await createEmailPending({
      suffix: "discard",
      amount: 5,
      title: "Aviso que el usuario no quiere registrar",
      originHint: "Clásica ****3087",
      destinationHint: "Tercero",
    });
    const discardedCode = buildPendingItemWhatsAppCode(discardedPending);
    const discarded = await resolvePendingFromWhatsAppAction({
      client: admin,
      userId,
      action: "discard",
      pendingCode: discardedCode,
      userText: `descartar ${discardedCode}`,
      traceId: randomUUID(),
    });
    assert(discarded.kind === "discarded", "el usuario puede descartar");

    const [movements, pendings] = await Promise.all([
      admin
        .from("movements")
        .select("id,type,account_origin_id,account_destination_id")
        .eq("user_id", userId),
      admin
        .from("pending_items")
        .select("id,status")
        .eq("user_id", userId),
    ]);
    if (movements.error) throw movements.error;
    if (pendings.error) throw pendings.error;
    assert(movements.data.length === 2, "se crean exactamente dos movimientos");
    assert(
      pendings.data.filter((item) => item.status === "user_confirmed").length ===
        2 &&
        pendings.data.filter((item) => item.status === "discarded").length ===
          1,
      "dos confirmados y uno descartado",
    );

    console.log(
      JSON.stringify(
        {
          ok: true,
          run_id: runId,
          invariants: {
            user_account_names_supported: true,
            transfer_reconfirmation_required: true,
            transfer_core_committed: true,
            transfer_retry_idempotent: true,
            explicit_alias_learning_audited: true,
            external_yape_as_expense_without_account: true,
            no_automatic_account_creation: true,
            discard_without_financial_write: true,
            movement_count: movements.data.length,
            final_origin_balance: balancesAfterExpense.get(origin.id),
            final_destination_balance: balancesAfterExpense.get(destination.id),
          },
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup();
  }
}

async function createEmailSourceFixture(): Promise<void> {
  if (!userId) throw new Error("Falta usuario fixture.");
  const institution = await admin.from("email_institutions").insert({
    institution_key: institutionKey,
    display_name: "Banco conversacional fixture",
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
      template_version: "conversation-smoke-v1",
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
        subject_patterns: ["Smoke conversacional"],
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
  const connection = await admin.rpc("commit_gmail_connection", {
    p_user_id: userId,
    p_email_address: gmailAddress,
    p_scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
    p_encrypted_refresh_token: "v1.fixture.fixture.fixture",
    p_history_id: "100",
    p_watch_expiration: new Date(
      Date.now() + 6 * 24 * 60 * 60 * 1000,
    ).toISOString(),
    p_trace_id: randomUUID(),
  });
  if (connection.error) throw connection.error;
  connectionId = connection.data.id;
  const source = await admin
    .from("user_email_sources")
    .insert({
      user_id: userId,
      institution_key: institutionKey,
      email_connection_id: connectionId,
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
}

async function createEmailPending(input: {
  suffix: string;
  amount: number;
  title: string;
  originHint: string;
  destinationHint: string;
}): Promise<PendingItem> {
  if (!userId || !connectionId || !templateId || !sourceId) {
    throw new Error("Fixture email incompleto.");
  }
  const occurredAt = new Date().toISOString();
  const result = await admin.rpc("commit_email_message_outcome", {
    p_user_id: userId,
    p_connection_id: connectionId,
    p_provider_message_id: `gmail-${input.suffix}-${runId}`,
    p_provider_thread_id: `thread-${input.suffix}-${runId}`,
    p_received_at: occurredAt,
    p_sender: sender,
    p_subject_hash: hashFor(input.suffix, "subject"),
    p_content_hash: hashFor(input.suffix, "content"),
    p_parsed_status: "parsed",
    p_pending: {
      proposed_action: {
        action: "review_specialized",
        movement_type: "transferencia",
        movement_input: {
          type: "transferencia",
          amount: input.amount,
          currency: "PEN",
          occurred_at: occurredAt,
          description: input.title,
          merchant: null,
          category_id: null,
          subcategory_id: null,
          account_origin_id: null,
          account_destination_id: null,
          box_origin_id: null,
          box_destination_id: null,
          related_person_id: null,
          debt_id: null,
          recurring_rule_id: null,
          recurring_occurrence_id: null,
          source: "email_confirmed",
          source_ref: `gmail:${input.suffix}-${runId}`,
          confidence: 0.99,
          requires_review: true,
          metadata: {
            fixture: true,
            specialized_engine_required: true,
            account_origin_hint: input.originHint,
            account_destination_hint: input.destinationHint,
          },
        },
      },
      normalized_summary: {
        title: input.title,
        amount: input.amount,
        currency: "PEN",
        occurred_at: occurredAt,
        category_id: null,
      },
      dedup_status: "unique",
      risk_level: "low",
      metadata: {
        fixture: true,
        template_id: templateId,
        email_source_id: sourceId,
        institution_key: institutionKey,
        suggested_movement_type: "transferencia",
        account_origin_hint: input.originHint,
        account_destination_hint: input.destinationHint,
        content_persisted: false,
      },
    },
    p_metadata: {
      fixture: true,
      template_id: templateId,
      email_source_id: sourceId,
      institution_key: institutionKey,
      parse_mode: "agent",
      entry_surface: "gmail_history",
      processing_latency_ms: 10,
      content_persisted: false,
    },
    p_trace_id: randomUUID(),
  });
  if (result.error) throw result.error;
  const pendingId = readString(toRecord(result.data).pending_item_id);
  if (!pendingId) throw new Error("RPC no devolvio pending_item_id.");
  const { data, error } = await admin
    .from("pending_items")
    .select("*")
    .eq("id", pendingId)
    .single();
  if (error || !data) throw error ?? new Error("No se creo Pendiente.");
  return data as PendingItem;
}

async function requireAccount(accountId: string) {
  if (!userId) throw new Error("Falta usuario.");
  const { data, error } = await admin
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .eq("id", accountId)
    .single();
  if (error || !data) throw error ?? new Error("Cuenta no encontrada.");
  return data;
}

async function readBalances(user: string): Promise<Map<string, number>> {
  const { data, error } = await admin
    .from("accounts")
    .select("id,current_balance")
    .eq("user_id", user)
    .is("deleted_at", null)
    .order("id");
  if (error) throw error;
  return new Map(
    (data ?? []).map((account) => [
      account.id,
      Number(account.current_balance),
    ]),
  );
}

async function apiRequest(
  path: string,
  accessToken: string,
  options: { method?: string; body?: Record<string, unknown> } = {},
) {
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

async function cleanup(): Promise<void> {
  const fixtureUserId = userId;
  if (templateId) {
    const deletedTemplate = await admin
      .from("email_parse_templates")
      .delete()
      .eq("id", templateId);
    if (deletedTemplate.error) throw deletedTemplate.error;
  }
  if (fixtureUserId) {
    const deletedEvents = await admin
      .from("external_event_log")
      .delete()
      .eq("user_id", fixtureUserId);
    if (deletedEvents.error) throw deletedEvents.error;
    const deletedUser = await admin.auth.admin.deleteUser(fixtureUserId);
    if (deletedUser.error) throw deletedUser.error;
  }
  const deletedInstitution = await admin
    .from("email_institutions")
    .delete()
    .eq("institution_key", institutionKey)
    .eq("metadata->>fixture", "true");
  if (deletedInstitution.error) throw deletedInstitution.error;

  const checks = await Promise.all([
    admin
      .from("email_parse_templates")
      .select("id", { count: "exact", head: true })
      .eq("institution_key", institutionKey),
    admin
      .from("email_institutions")
      .select("institution_key", { count: "exact", head: true })
      .eq("institution_key", institutionKey),
    fixtureUserId
      ? admin
          .from("user_email_sources")
          .select("id", { count: "exact", head: true })
          .eq("user_id", fixtureUserId)
      : Promise.resolve({ count: 0, error: null }),
    fixtureUserId
      ? admin
          .from("pending_items")
          .select("id", { count: "exact", head: true })
          .eq("user_id", fixtureUserId)
      : Promise.resolve({ count: 0, error: null }),
    fixtureUserId
      ? admin
          .from("movements")
          .select("id", { count: "exact", head: true })
          .eq("user_id", fixtureUserId)
      : Promise.resolve({ count: 0, error: null }),
  ]);
  for (const check of checks) {
    if (check.error) throw check.error;
    if ((check.count ?? 0) !== 0) {
      throw new Error("El fixture conversacional dejo residuos.");
    }
  }
  console.log(
    JSON.stringify({
      fixture_cleanup_verified: true,
      residual_rows: 0,
    }),
  );
}

function hashFor(...values: string[]): string {
  return Buffer.from(values.join(":"))
    .toString("hex")
    .padEnd(64, "0")
    .slice(0, 64);
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Smoke conversacional fallo: ${message}.`);
  }
}
