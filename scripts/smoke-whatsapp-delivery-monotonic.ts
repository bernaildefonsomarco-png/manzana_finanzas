import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { reconcileWhatsAppDeliveryStatusByProviderMessageId } from "@/data/repositories/whatsapp-delivery.repository";
import type { Database } from "@/data/supabase/types";

loadEnvConfig(process.cwd());

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const runId = crypto.randomUUID();
const providerMessageId = `wamid.smoke.monotonic.${runId}`;
let fixtureUserId: string | null = null;

void main();

async function main(): Promise<void> {
  try {
    fixtureUserId = await createFixtureUser();
    await createDeliveryAttempt(fixtureUserId);

    const readAt = new Date().toISOString();
    const readResult =
      await reconcileWhatsAppDeliveryStatusByProviderMessageId(admin, {
        userId: fixtureUserId,
        providerMessageId,
        deliveryStatus: "read",
        receivedAt: readAt,
        traceId: crypto.randomUUID(),
        conversationId: `smoke-${runId}`,
        pricingCategory: "service",
      });
    assert(readResult.reconciled, "read no fue reconciliado");

    const staleSentAt = new Date(Date.now() + 1_000).toISOString();
    const sentResult =
      await reconcileWhatsAppDeliveryStatusByProviderMessageId(admin, {
        userId: fixtureUserId,
        providerMessageId,
        deliveryStatus: "sent",
        receivedAt: staleSentAt,
        traceId: crypto.randomUUID(),
        conversationId: `smoke-${runId}`,
        pricingCategory: "service",
      });
    assert(sentResult.reconciled, "sent fuera de orden no fue reconciliado");
    assert(sentResult.attempt, "falta intento reconciliado");

    const responseSummary = toRecord(sentResult.attempt.response_summary);
    const metadata = toRecord(sentResult.attempt.metadata);
    assert(
      responseSummary.latest_delivery_status === "read",
      "response_summary retrocedio de read a sent",
    );
    assert(
      metadata.latest_delivery_status === "read",
      "metadata retrocedio de read a sent",
    );
    assert(
      metadata.last_delivery_event_status === "sent",
      "el evento fuera de orden no quedo auditable",
    );
    assert(
      responseSummary.delivery_status_received_at === readAt,
      "la fecha del estado read fue reemplazada por sent",
    );

    console.log(
      JSON.stringify({
        ok: true,
        run_id: runId,
        sequence: ["read", "sent"],
        final_delivery_status: responseSummary.latest_delivery_status,
        last_delivery_event_status: metadata.last_delivery_event_status,
        financial_write: false,
      }),
    );
  } finally {
    await cleanup();
  }
}

async function createFixtureUser(): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email: `smoke-whatsapp-monotonic-${runId}@example.com`,
    password: "Password123!",
    email_confirm: true,
    user_metadata: { source: "smoke-whatsapp-delivery-monotonic" },
  });
  if (created.error) throw created.error;

  const userId = created.data.user.id;
  const { error } = await admin.from("profiles").upsert({
    id: userId,
    display_name: "Smoke WhatsApp Monotonic",
    phone_e164: `+519${String(Date.now()).slice(-8)}`,
    timezone: "America/Lima",
    locale: "es-PE",
    onboarding_status: "completed",
  });
  if (error) throw error;
  return userId;
}

async function createDeliveryAttempt(userId: string): Promise<void> {
  const { error } = await admin.from("whatsapp_delivery_attempts").insert({
    user_id: userId,
    provider: "kapso",
    direction: "outbound",
    message_kind: "interactive",
    to_phone: `+519${String(Date.now()).slice(-8)}`,
    idempotency_key: `smoke-monotonic:${runId}`,
    trace_id: crypto.randomUUID(),
    provider_message_id: providerMessageId,
    status: "accepted",
    response_summary: {},
    metadata: { fixture: true },
  });
  if (error) throw error;
}

async function cleanup(): Promise<void> {
  if (!fixtureUserId) return;

  const userId = fixtureUserId;
  const deletedUser = await admin.auth.admin.deleteUser(userId);
  if (deletedUser.error) throw deletedUser.error;
  const residual = await admin
    .from("whatsapp_delivery_attempts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (residual.error) throw residual.error;
  assert((residual.count ?? 0) === 0, "el fixture dejo intentos residuales");
  console.log(
    JSON.stringify({
      fixture_cleanup_verified: true,
      residual_rows: residual.count ?? 0,
    }),
  );
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`Smoke delivery monotono fallo: ${message}.`);
  }
}
