import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

loadEnv(".env.local");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan credenciales Supabase para el smoke de onboarding.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const runId = randomUUID();
const password = `${randomUUID()}Aa1!`;
let userId = null;

try {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `onboarding-${runId}@example.invalid`,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) throw createError ?? new Error("Sin usuario");
  userId = created.user.id;

  const profile = await waitForProfile(userId);
  assert(profile.onboarding_status === "not_started", "perfil inicia not_started");

  const firstStart = await advance(userId, "started", "initial_action_selected");
  const repeatedStart = await advance(userId, "started", "initial_action_selected");
  const firstValue = await advance(userId, "first_value_reached", "movement_confirmed");
  const repeatedValue = await advance(userId, "first_value_reached", "movement_confirmed");

  assert(firstStart.changed === true, "primer start cambia estado");
  assert(repeatedStart.changed === false, "retry start es idempotente");
  assert(firstValue.changed === true, "primer valor cambia estado");
  assert(repeatedValue.changed === false, "retry primer valor es idempotente");

  const { data: finalProfile, error: profileError } = await admin
    .from("profiles")
    .select("onboarding_status")
    .eq("id", userId)
    .single();
  if (profileError) throw profileError;
  assert(
    finalProfile.onboarding_status === "first_value_reached",
    "estado final first_value_reached",
  );

  const { data: outbox, error: outboxError } = await admin
    .from("transactional_outbox")
    .select("event_type,payload,status")
    .eq("user_id", userId)
    .eq("event_type", "onboarding_stage_changed")
    .order("created_at");
  if (outboxError) throw outboxError;
  assert(outbox.length === 2, "solo dos eventos de transicion");
  assert(
    outbox[0]?.payload?.current_status === "started" &&
      outbox[1]?.payload?.current_status === "first_value_reached",
    "outbox conserva orden y estados",
  );

  const [movements, debts, pending] = await Promise.all([
    countRows("movements", userId),
    countRows("debts", userId),
    countRows("pending_items", userId),
  ]);
  assert(movements === 0, "onboarding no crea movimientos");
  assert(debts === 0, "onboarding no crea deudas");
  assert(pending === 0, "onboarding no crea pendientes");

  console.log(
    JSON.stringify(
      {
        ok: true,
        run: runId.slice(0, 8),
        transitions: [
          firstStart.current_status,
          firstValue.current_status,
        ],
        idempotent_retries: 2,
        outbox_events: outbox.length,
        financial_rows_created: 0,
      },
      null,
      2,
    ),
  );
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) throw error;
  }
}

async function advance(targetUserId, targetStatus, trigger) {
  const { data, error } = await admin.rpc("advance_onboarding_stage", {
    p_user_id: targetUserId,
    p_target_status: targetStatus,
    p_trigger: trigger,
    p_source: "staging_smoke",
    p_trace_id: randomUUID(),
  });
  if (error) throw error;
  return data;
}

async function waitForProfile(targetUserId) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { data, error } = await admin
      .from("profiles")
      .select("onboarding_status")
      .eq("id", targetUserId)
      .maybeSingle();
    if (error) throw error;
    if (data) return data;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error("El trigger de profile no termino a tiempo.");
}

async function countRows(table, targetUserId) {
  const column = table === "profiles" ? "id" : "user_id";
  const { count, error } = await admin
    .from(table)
    .select("*", { count: "exact", head: true })
    .eq(column, targetUserId);
  if (error) throw error;
  return count ?? 0;
}

function assert(condition, message) {
  if (!condition) throw new Error(`Smoke onboarding fallo: ${message}`);
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
