import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { buildPendingItemReferenceCode } from "@/core/pending/reference-code";
import { resolvePendingFromAction } from "@/core/orchestrator/pending-resolution-from-text";
import type { Database } from "@/data/supabase/types";
import type { PendingItem } from "@/shared/types/domain";

loadEnvConfig(process.cwd());

const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const pendingIds = requireEnv("SMOKE_PENDING_ITEM_IDS")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

void main();

async function main(): Promise<void> {
  for (const pendingId of pendingIds) {
    const pendingBefore = await requirePending(pendingId);
    if (pendingBefore.source !== "email_pending") {
      throw new Error(`${pendingId} no es un Pendiente email live.`);
    }
    const [movementsBefore, accountsBefore] = await Promise.all([
      countMovements(pendingBefore.user_id),
      readAccountBalances(pendingBefore.user_id),
    ]);
    const pendingCode = buildPendingItemReferenceCode(pendingBefore);
    const result = await resolvePendingFromAction({
      client: admin,
      userId: pendingBefore.user_id,
      action: "review",
      pendingCode,
      userText: `revisar ${pendingCode}`,
      traceId: `smoke-review-${crypto.randomUUID()}`,
      channel: "whatsapp" as const,
    });
    if (result.kind !== "reviewed") {
      throw new Error(
        `${pendingCode} no devolvio revision segura: ${result.kind}/${result.reason}`,
      );
    }

    const [pendingAfter, movementsAfter, accountsAfter] = await Promise.all([
      requirePending(pendingId),
      countMovements(pendingBefore.user_id),
      readAccountBalances(pendingBefore.user_id),
    ]);
    assertEqual(
      pendingAfter.status,
      pendingBefore.status,
      `${pendingCode}: status`,
    );
    assertEqual(
      JSON.stringify(pendingAfter.proposed_action),
      JSON.stringify(pendingBefore.proposed_action),
      `${pendingCode}: propuesta`,
    );
    assertEqual(movementsAfter, movementsBefore, `${pendingCode}: movimientos`);
    assertEqual(
      JSON.stringify(accountsAfter),
      JSON.stringify(accountsBefore),
      `${pendingCode}: saldos`,
    );

    console.log(
      JSON.stringify({
        ok: true,
        pending_code: pendingCode,
        account_options: result.account_options.map((account) => ({
          name: account.name,
          institution: account.institution,
          currency: account.currency,
        })),
        financial_write: false,
        pending_unchanged: true,
        movements_unchanged: true,
        balances_unchanged: true,
      }),
    );
  }
}

async function requirePending(pendingId: string): Promise<PendingItem> {
  const { data, error } = await admin
    .from("pending_items")
    .select("*")
    .eq("id", pendingId)
    .single();
  if (error || !data) throw error ?? new Error("Pendiente no encontrado.");
  return data as PendingItem;
}

async function countMovements(userId: string): Promise<number> {
  const { count, error } = await admin
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (error) throw error;
  return count ?? 0;
}

async function readAccountBalances(
  userId: string,
): Promise<Array<{ id: string; current_balance: number }>> {
  const { data, error } = await admin
    .from("accounts")
    .select("id,current_balance")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("id");
  if (error) throw error;
  return (data ?? []).map((account) => ({
    id: account.id,
    current_balance: Number(account.current_balance),
  }));
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Falta ${name}.`);
  return value;
}

function assertEqual(
  actual: unknown,
  expected: unknown,
  label: string,
): void {
  if (actual !== expected) {
    throw new Error(`${label} cambio durante una revision read-only.`);
  }
}
