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

const email = `debt-due-nudge-${Date.now()}@example.invalid`;
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
  const dueDate = new Date().toISOString().slice(0, 10);
  const debtResponse = await apiRequest("/api/v1/debts", accessToken, {
    method: "POST",
    body: {
      direction: "i_owe",
      kind: "installment_purchase",
      name: "Smoke aviso cuota",
      related_person_name: null,
      principal_amount: 100,
      currency: "PEN",
      due_date: dueDate,
      next_payment_date: dueDate,
      installment_count: 2,
      installment_amount: 50,
      interest_notes: "Usuario temporal de QA automatizado.",
    },
  });
  const debtId = debtResponse.data.debt.id;
  const detailBefore = await apiRequest(
    `/api/v1/debts/${debtId}`,
    accessToken
  );
  const financialBefore = financialSnapshot(detailBefore.data.debt);

  await workerRequest(userId);

  const homeWithNudge = await apiRequest("/api/v1/dashboard/home", accessToken);
  const debtNudges = homeWithNudge.data.dashboard_nudges.filter(
    (candidate) => candidate.type === "debt_due"
  );
  if (debtNudges.length !== 1) {
    throw new Error(`Se esperaban 1 debt_due y llegaron ${debtNudges.length}.`);
  }
  if (
    debtNudges[0].debt_id !== debtId ||
    debtNudges[0].installment_id !==
      detailBefore.data.debt.installments[0].id
  ) {
    throw new Error("El aviso no apunta a la cuota abierta mas antigua.");
  }

  const preferencesBefore = await apiRequest(
    "/api/v1/preferences/nudges",
    accessToken
  );
  assertPreference(preferencesBefore, "debt_due", true, false);

  const disabled = await apiRequest(
    "/api/v1/preferences/nudges",
    accessToken,
    {
      method: "POST",
      body: {
        nudge_type: "debt_due",
        enabled: false,
      },
    }
  );
  assertPreference(disabled, "debt_due", false, true);

  const homeWithoutNudge = await apiRequest(
    "/api/v1/dashboard/home",
    accessToken
  );
  if (
    homeWithoutNudge.data.dashboard_nudges.some(
      (candidate) => candidate.type === "debt_due"
    )
  ) {
    throw new Error("Desactivar la preferencia no retiro el aviso de Home.");
  }

  const detailAfterDisable = await apiRequest(
    `/api/v1/debts/${debtId}`,
    accessToken
  );
  assertFinancialSnapshot(
    financialBefore,
    financialSnapshot(detailAfterDisable.data.debt)
  );

  const enabled = await apiRequest(
    "/api/v1/preferences/nudges",
    accessToken,
    {
      method: "POST",
      body: {
        nudge_type: "debt_due",
        enabled: true,
      },
    }
  );
  assertPreference(enabled, "debt_due", true, true);

  const homeReenabled = await apiRequest(
    "/api/v1/dashboard/home",
    accessToken
  );
  if (
    !homeReenabled.data.dashboard_nudges.some(
      (candidate) => candidate.type === "debt_due"
    )
  ) {
    throw new Error("Reactivar la preferencia no restauro el aviso.");
  }

  const detailAfterEnable = await apiRequest(
    `/api/v1/debts/${debtId}`,
    accessToken
  );
  assertFinancialSnapshot(
    financialBefore,
    financialSnapshot(detailAfterEnable.data.debt)
  );

  console.log(
    JSON.stringify({
      status: "ok",
      nudge_type: "debt_due",
      source_entity_type: "debt_installment",
      oldest_installment_only: true,
      disabled_removed_from_home: true,
      reenabled_restored_to_home: true,
      financial_state_unchanged: true,
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

async function workerRequest(targetUserId) {
  const response = await fetch(
    `${appBaseUrl}/api/internal/jobs/nudges-evaluate?user_id=${targetUserId}&horizon_days=3`,
    {
      headers: {
        Authorization: `Bearer ${workerSecret}`,
      },
    }
  );
  const payload = await response.json();

  if (!response.ok || !payload.ok) {
    throw new Error(
      `nudges-evaluate fallo ${response.status}: ${JSON.stringify(payload)}`
    );
  }
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

function assertPreference(payload, nudgeType, enabled, configured) {
  const preference = payload.data.preferences.find(
    (candidate) => candidate.nudge_type === nudgeType
  );

  if (
    !preference ||
    preference.enabled !== enabled ||
    preference.configured !== configured
  ) {
    throw new Error(
      `Preferencia inesperada: ${JSON.stringify(preference)}`
    );
  }
}

function financialSnapshot(debt) {
  return {
    current_balance: debt.current_balance,
    status: debt.status,
    next_payment_date: debt.next_payment_date,
    installments: debt.installments.map((installment) => ({
      id: installment.id,
      paid_amount: installment.paid_amount,
      status: installment.status,
    })),
  };
}

function assertFinancialSnapshot(expected, actual) {
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error(
      `El aviso altero estado financiero: ${JSON.stringify(expected)} != ${JSON.stringify(actual)}`
    );
  }
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
