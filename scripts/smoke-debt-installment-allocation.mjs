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

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Faltan credenciales Supabase para el smoke.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const authClient = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `debt-allocation-${Date.now()}@example.invalid`;
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
  const accountResponse = await apiRequest("/api/v1/accounts", accessToken, {
    method: "POST",
    body: {
      name: "Cuenta smoke",
      type: "digital",
      institution: null,
      currency: "PEN",
      initial_balance: 100,
      is_default: true,
      color: null,
      icon: null,
    },
  });
  const accountId = accountResponse.data.account.id;
  const debtResponse = await apiRequest("/api/v1/debts", accessToken, {
    method: "POST",
    body: {
      direction: "i_owe",
      kind: "installment_purchase",
      name: "Smoke conciliacion cuotas",
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

  const first = await registerPayment(debtId, accessToken, 30, "first", null);
  assertAllocations(first, [30]);

  const second = await registerPayment(
    debtId,
    accessToken,
    40,
    "second",
    accountId
  );
  assertAllocations(second, [20, 20]);

  const middleDetail = await apiRequest(
    `/api/v1/debts/${debtId}`,
    accessToken
  );
  assertInstallments(middleDetail.data.debt.installments, [
    { paid: 50, status: "paid", allocations: 2 },
    { paid: 20, status: "pending", allocations: 1 },
  ]);

  const accountsResponse = await apiRequest("/api/v1/accounts", accessToken);
  const account = accountsResponse.data.accounts.find(
    (candidate) => candidate.id === accountId
  );
  if (!account || account.current_balance !== 60) {
    throw new Error("El pago con cuenta no redujo el saldo de 100 a 60.");
  }

  const third = await registerPayment(debtId, accessToken, 30, "third", null);
  assertAllocations(third, [30]);

  const finalDetail = await apiRequest(
    `/api/v1/debts/${debtId}`,
    accessToken
  );
  assertInstallments(finalDetail.data.debt.installments, [
    { paid: 50, status: "paid", allocations: 2 },
    { paid: 50, status: "paid", allocations: 2 },
  ]);

  if (
    finalDetail.data.debt.current_balance !== 0 ||
    finalDetail.data.debt.status !== "paid"
  ) {
    throw new Error("La deuda no cerro con saldo cero y estado paid.");
  }

  console.log(
    JSON.stringify({
      status: "ok",
      policy: third.data.allocation_policy,
      first_payment_allocations: [30],
      second_payment_allocations: [20, 20],
      third_payment_allocations: [30],
      account_balance_after_linked_payment: account.current_balance,
      final_balance: finalDetail.data.debt.current_balance,
      final_status: finalDetail.data.debt.status,
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

async function registerPayment(
  debtId,
  accessToken,
  amount,
  suffix,
  accountId
) {
  return apiRequest(`/api/v1/debts/${debtId}/payments`, accessToken, {
    method: "POST",
    idempotencyKey: `debt-allocation-smoke:${suffix}:${randomUUID()}`,
    body: {
      amount,
      account_id: accountId,
      paid_at: new Date().toISOString(),
      note: `Smoke ${suffix}`,
    },
  });
}

async function apiRequest(path, accessToken, options = {}) {
  const response = await fetch(`${appBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.idempotencyKey
        ? { "Idempotency-Key": options.idempotencyKey }
        : {}),
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

function assertAllocations(payload, expectedAmounts) {
  const allocations = payload.data.installment_allocations;
  const amounts = allocations.map((allocation) => allocation.allocated_amount);

  if (JSON.stringify(amounts) !== JSON.stringify(expectedAmounts)) {
    throw new Error(
      `Asignaciones inesperadas: ${JSON.stringify(amounts)} != ${JSON.stringify(expectedAmounts)}`
    );
  }

  if (payload.data.allocation_policy !== "oldest_open_due_date_first_v1") {
    throw new Error("La politica de asignacion no coincide.");
  }
}

function assertInstallments(installments, expected) {
  const actual = installments
    .slice()
    .sort((left, right) => left.number - right.number)
    .map((installment) => ({
      paid: installment.paid_amount,
      status: installment.status,
      allocations: installment.allocations.length,
    }));

  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `Cuotas inesperadas: ${JSON.stringify(actual)} != ${JSON.stringify(expected)}`
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
