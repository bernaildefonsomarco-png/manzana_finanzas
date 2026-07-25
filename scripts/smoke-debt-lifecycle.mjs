import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const env = await loadEnv(".env.local");
const appBaseUrl =
  process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "https://manzana.website";
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey =
  env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const workerSecret = env.CRON_SECRET ?? env.WORKER_SECRET;

if (!supabaseUrl || !anonKey || !serviceRoleKey || !workerSecret) {
  throw new Error("Faltan credenciales Supabase o secreto del worker.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `debt-lifecycle-${Date.now()}@example.invalid`;
const password = `Smoke-${randomUUID()}-9a`;
let userId = null;

try {
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

  if (createError || !created.user) {
    throw createError ?? new Error("No se pudo crear el usuario temporal.");
  }

  userId = created.user.id;
  const { data: sessionData, error: signInError } =
    await authClient.auth.signInWithPassword({ email, password });

  if (signInError || !sessionData.session) {
    throw signInError ?? new Error("No se pudo iniciar la sesion temporal.");
  }

  const accessToken = sessionData.session.access_token;
  await apiRequest("/api/v1/accounts", accessToken, {
    method: "POST",
    body: {
      name: "Cuenta lifecycle smoke",
      type: "digital",
      institution: null,
      currency: "PEN",
      initial_balance: 321,
      is_default: true,
      color: null,
      icon: null,
    },
  });

  const today = localIsoDate(new Date(), "America/Lima");
  const cases = [
    {
      label: "vencida",
      dueDate: addDays(today, -1),
      debtStatus: "overdue",
      installmentStatus: "overdue",
    },
    {
      label: "proxima",
      dueDate: today,
      debtStatus: "due_soon",
      installmentStatus: "due_soon",
    },
    {
      label: "futura",
      dueDate: addDays(today, 4),
      debtStatus: "active",
      installmentStatus: "pending",
    },
  ];
  const debtIds = [];

  for (const [index, testCase] of cases.entries()) {
    const response = await apiRequest("/api/v1/debts", accessToken, {
      method: "POST",
      body: {
        direction: "i_owe",
        kind: "installment_purchase",
        name: `Smoke lifecycle ${testCase.label}`,
        principal_amount: (index + 1) * 100,
        currency: "PEN",
        due_date: testCase.dueDate,
        next_payment_date: testCase.dueDate,
        installment_count: 1,
        installment_amount: (index + 1) * 100,
      },
    });
    debtIds.push(response.data.debt.id);
  }

  const before = await financialSnapshot(userId, debtIds);
  const immediateRefreshApplied = lifecycleStatesMatch(before, debtIds, cases);
  const traceId = randomUUID();
  const { data: first, error: firstError } = await admin.rpc(
    "refresh_debt_installment_lifecycle",
    {
      p_user_id: userId,
      p_as_of_date: today,
      p_due_soon_days: 3,
      p_trace_id: traceId,
    }
  );

  if (firstError || !first) {
    throw firstError ?? new Error("El primer refresh no devolvio resultado.");
  }

  assertLifecycleCounts(first, {
    installments_updated: immediateRefreshApplied ? 0 : 2,
    debts_updated: immediateRefreshApplied ? 0 : 2,
    events_created: immediateRefreshApplied ? 0 : 4,
  });

  const afterFirst = await financialSnapshot(userId, debtIds);
  assertStatuses(afterFirst, debtIds, cases);
  assertAmountsUnchanged(before, afterFirst);

  const { data: second, error: secondError } = await admin.rpc(
    "refresh_debt_installment_lifecycle",
    {
      p_user_id: userId,
      p_as_of_date: today,
      p_due_soon_days: 3,
      p_trace_id: randomUUID(),
    }
  );

  if (secondError || !second) {
    throw secondError ?? new Error("El segundo refresh no devolvio resultado.");
  }

  assertLifecycleCounts(second, {
    installments_updated: 0,
    debts_updated: 0,
    events_created: 0,
  });

  const workerResult = await workerRequest(userId, today);
  assertLifecycleCounts(workerResult.lifecycle, {
    installments_updated: 0,
    debts_updated: 0,
    events_created: 0,
  });

  const { data: events, error: eventsError } = await admin
    .from("transactional_outbox")
    .select("event_type, aggregate_id")
    .eq("user_id", userId)
    .in("event_type", [
      "debt_installment_due_soon",
      "debt_installment_overdue",
      "debt_due_soon",
      "debt_overdue",
    ]);

  if (eventsError) throw eventsError;
  if ((events ?? []).length !== 4) {
    throw new Error(`Se esperaban 4 eventos unicos y llegaron ${events?.length}.`);
  }

  const { data: nudges, error: nudgesError } = await admin
    .from("nudge_candidates")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "debt_due")
    .in("status", ["candidate", "approved", "deferred", "scheduled"]);

  if (nudgesError) throw nudgesError;
  if ((nudges ?? []).length !== 2) {
    throw new Error(
      `Se esperaban 2 avisos debt_due y llegaron ${nudges?.length}.`
    );
  }

  const { error: clientRpcError } = await authClient.rpc(
    "refresh_debt_installment_lifecycle",
    {
      p_user_id: userId,
      p_as_of_date: today,
      p_due_soon_days: 3,
      p_trace_id: randomUUID(),
    }
  );

  if (!clientRpcError) {
    throw new Error("authenticated pudo ejecutar un RPC reservado a Core.");
  }

  console.log(
    JSON.stringify({
      status: "ok",
      as_of_date: today,
      installment_statuses: cases.map((item) => item.installmentStatus),
      immediate_refresh_applied: immediateRefreshApplied,
      first_run_events: first.events_created,
      second_run_events: second.events_created,
      worker_route_idempotent: true,
      debt_due_nudges: nudges.length,
      outbox_events_unique: true,
      authenticated_rpc_blocked: true,
      balances_and_amounts_unchanged: true,
    })
  );
} finally {
  if (userId) {
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) {
      console.error(`No se pudo eliminar el usuario temporal: ${error.message}`);
      process.exitCode = 1;
    }
  }
}

async function financialSnapshot(targetUserId, debtIds) {
  const [accounts, boxes, movements, debts, installments] = await Promise.all([
    admin.from("accounts").select("id, current_balance").eq("user_id", targetUserId),
    admin.from("boxes").select("id, current_balance").eq("user_id", targetUserId),
    admin.from("movements").select("id").eq("user_id", targetUserId),
    admin
      .from("debts")
      .select("id, principal_amount, current_balance, status")
      .eq("user_id", targetUserId)
      .in("id", debtIds),
    admin
      .from("debt_installments")
      .select("id, debt_id, expected_amount, paid_amount, status")
      .eq("user_id", targetUserId)
      .in("debt_id", debtIds),
  ]);

  for (const result of [accounts, boxes, movements, debts, installments]) {
    if (result.error) throw result.error;
  }

  return {
    accounts: accounts.data ?? [],
    boxes: boxes.data ?? [],
    movements: movements.data ?? [],
    debts: debts.data ?? [],
    installments: installments.data ?? [],
  };
}

function assertLifecycleCounts(actual, expected) {
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(`${key}: se esperaba ${value} y llego ${actual[key]}.`);
    }
  }
}

function assertStatuses(snapshot, debtIds, cases) {
  for (const [index, debtId] of debtIds.entries()) {
    const debt = snapshot.debts.find((item) => item.id === debtId);
    const installment = snapshot.installments.find(
      (item) => item.debt_id === debtId
    );
    const debtStatus = cases[index].debtStatus;
    const installmentStatus = cases[index].installmentStatus;

    if (!debt || debt.status !== debtStatus) {
      throw new Error(`Estado de deuda inesperado para ${cases[index].label}.`);
    }
    if (!installment || installment.status !== installmentStatus) {
      throw new Error(`Estado de cuota inesperado para ${cases[index].label}.`);
    }
  }
}

function lifecycleStatesMatch(snapshot, debtIds, cases) {
  try {
    assertStatuses(snapshot, debtIds, cases);
    return true;
  } catch {
    return false;
  }
}

function assertAmountsUnchanged(before, after) {
  const stableBefore = {
    accounts: sortRows(before.accounts),
    boxes: sortRows(before.boxes),
    movements: sortRows(before.movements),
    debts: sortRows(before.debts.map(stableDebtAmountFields)),
    installments: sortRows(
      before.installments.map(stableInstallmentAmountFields)
    ),
  };
  const stableAfter = {
    accounts: sortRows(after.accounts),
    boxes: sortRows(after.boxes),
    movements: sortRows(after.movements),
    debts: sortRows(after.debts.map(stableDebtAmountFields)),
    installments: sortRows(
      after.installments.map(stableInstallmentAmountFields)
    ),
  };

  if (JSON.stringify(stableBefore) !== JSON.stringify(stableAfter)) {
    throw new Error("El lifecycle altero saldos, importes o movimientos.");
  }
}

function sortRows(rows) {
  return [...rows].sort((left, right) => left.id.localeCompare(right.id));
}

function stableDebtAmountFields(item) {
  return {
    id: item.id,
    principal_amount: item.principal_amount,
    current_balance: item.current_balance,
  };
}

function stableInstallmentAmountFields(item) {
  return {
    id: item.id,
    debt_id: item.debt_id,
    expected_amount: item.expected_amount,
    paid_amount: item.paid_amount,
  };
}

async function apiRequest(path, accessToken, options = {}) {
  const response = await fetch(`${appBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${path} fallo ${response.status}: ${JSON.stringify(payload)}`
    );
  }

  return payload;
}

async function workerRequest(targetUserId, asOfDate) {
  const response = await fetch(
    `${appBaseUrl}/api/internal/jobs/debt-lifecycle?user_id=${targetUserId}&as_of_date=${asOfDate}&due_soon_days=3`,
    {
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
    }
  );
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      `debt-lifecycle fallo ${response.status}: ${JSON.stringify(payload)}`
    );
  }

  return payload.data.results[0].result;
}

function localIsoDate(date, timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

function addDays(value, amount) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

async function loadEnv(path) {
  const content = await readFile(path, "utf8");
  return Object.fromEntries(
    content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      })
  );
}
