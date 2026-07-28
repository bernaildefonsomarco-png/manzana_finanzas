import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createDebt } from "../src/data/repositories/debts.repository";
import { markPendingDiscarded } from "../src/data/repositories/pending.repository";
import type { Database } from "../src/data/supabase/types";

loadEnv(".env.local");

const args = parseArgs(process.argv.slice(2));
const mode = args.mode ?? "locate";
const handshake = args.handshake ?? "QA27 listo";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Faltan credenciales Supabase para gestionar fixtures QA.");
}
if (
  !new Set([
    "locate",
    "create",
    "status",
    "clear-capture",
    "discard-event-pending",
    "cleanup",
  ]).has(mode)
) {
  throw new Error(
    "mode debe ser locate, create, status, clear-capture, discard-event-pending o cleanup.",
  );
}

const admin = createClient<Database>(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const target = await findHandshakeTarget();

if (mode === "locate") {
  print({
    ok: true,
    mode,
    handshake_found: true,
    handshake_received_at: target.receivedAt,
    linked_profile: true,
  });
} else if (mode === "create") {
  await createFixtures();
} else if (mode === "status") {
  await reportFixtureStatus();
} else if (mode === "clear-capture") {
  await clearCaptureDraft();
} else if (mode === "discard-event-pending") {
  await discardEventPending();
} else {
  await cleanupFixtures();
}

async function findHandshakeTarget() {
  const since = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("external_event_log")
    .select("id,user_id,received_at,metadata")
    .eq("source", "whatsapp")
    .gte("received_at", since)
    .order("received_at", { ascending: false })
    .limit(100);
  if (error) throw error;

  const matches = (data ?? []).filter(
    (event) =>
      event.user_id &&
      normalize(readMetadataString(event.metadata, "text") ?? "") ===
        normalize(handshake),
  );
  if (matches.length === 0) {
    throw new Error(`No se encontro el handshake reciente "${handshake}".`);
  }

  const userIds = new Set(matches.map((event) => event.user_id));
  if (userIds.size !== 1) {
    throw new Error("El handshake coincide con mas de una cuenta reciente.");
  }

  const latest = matches[0];
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,phone_e164,onboarding_status")
    .eq("id", latest.user_id!)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.phone_e164) {
    throw new Error("La cuenta del handshake no tiene WhatsApp vinculado.");
  }

  return {
    userId: latest.user_id!,
    receivedAt: latest.received_at,
  };
}

async function createFixtures() {
  const { data: existing, error: existingError } = await admin
    .from("debts")
    .select("id,name,metadata")
    .eq("user_id", target.userId)
    .is("deleted_at", null)
    .contains("metadata", { qa_fixture: true });
  if (existingError) throw existingError;
  if ((existing ?? []).length > 0) {
    throw new Error(
      "Ya existen fixtures QA activos en esta cuenta; limpialos antes de crear otros.",
    );
  }

  const runId = randomUUID();
  const token = runId.slice(0, 8);
  const personName = `Pedro QA ${token}`;
  const primaryDebtName = `Prestamo QA ${token}`;
  const ambiguousDebtName = `Tarjeta QA ${token}`;
  const usdDebtName = `Dolares QA ${token}`;
  const dueDate = new Date().toISOString().slice(0, 10);
  const metadata = {
    qa_fixture: true,
    qa_run_id: runId,
    qa_scope: "whatsapp_debt_payment_human_gate",
    created_from: "codex_authorized_human_qa",
  };

  const created = [];
  try {
    created.push(
      await createDebt(admin, {
        userId: target.userId,
        direction: "i_owe",
        kind: "personal",
        name: primaryDebtName,
        relatedPersonName: personName,
        principalAmount: 100,
        currency: "PEN",
        dueDate,
        nextPaymentDate: dueDate,
        installmentCount: 2,
        installmentAmount: 50,
        interestNotes: "Fixture temporal gate humano previo al Corte 27",
        source: "qa_human_whatsapp",
        metadata,
      }),
    );
    created.push(
      await createDebt(admin, {
        userId: target.userId,
        direction: "i_owe",
        kind: "personal",
        name: ambiguousDebtName,
        relatedPersonName: personName,
        principalAmount: 60,
        currency: "PEN",
        dueDate,
        nextPaymentDate: dueDate,
        installmentCount: 1,
        installmentAmount: 60,
        interestNotes: "Fixture temporal gate humano previo al Corte 27",
        source: "qa_human_whatsapp",
        metadata,
      }),
    );
    created.push(
      await createDebt(admin, {
        userId: target.userId,
        direction: "i_owe",
        kind: "personal",
        name: usdDebtName,
        relatedPersonName: `Dollar QA ${token}`,
        principalAmount: 40,
        currency: "USD",
        dueDate,
        nextPaymentDate: dueDate,
        installmentCount: 1,
        installmentAmount: 40,
        interestNotes: "Fixture temporal gate humano previo al Corte 27",
        source: "qa_human_whatsapp",
        metadata,
      }),
    );
  } catch (error) {
    if (created.length > 0) {
      await admin
        .from("debts")
        .update({ deleted_at: new Date().toISOString() })
        .in(
          "id",
          created.map((result) => result.debt.id),
        );
    }
    throw error;
  }

  print({
    ok: true,
    mode,
    qa_run_id: runId,
    handshake_received_at: target.receivedAt,
    fixtures: {
      person_name: personName,
      primary_debt_name: primaryDebtName,
      ambiguous_debt_name: ambiguousDebtName,
      usd_debt_name: usdDebtName,
    },
    messages: [
      `Pago nuevo independiente: pague 10 soles a ${personName}`,
      `Pago nuevo independiente: pague 110 soles de ${primaryDebtName}`,
      `Pago nuevo independiente: pague 10 soles de ${usdDebtName}`,
      `Pague 30 soles de la primera cuota de ${primaryDebtName}`,
      `Pague los 70 soles restantes de ${primaryDebtName}`,
    ],
  });
}

async function cleanupFixtures() {
  const runId = args.run;
  if (!runId) throw new Error("cleanup requiere --run=UUID.");

  const { data: debts, error } = await admin
    .from("debts")
    .select("id,related_person_id,metadata")
    .eq("user_id", target.userId)
    .is("deleted_at", null)
    .contains("metadata", {
      qa_fixture: true,
      qa_run_id: runId,
      qa_scope: "whatsapp_debt_payment_human_gate",
    });
  if (error) throw error;
  if ((debts ?? []).length !== 3) {
    throw new Error(
      `Se esperaban 3 deudas QA activas para cleanup y se encontraron ${(debts ?? []).length}.`,
    );
  }

  const debtIds = debts!.map((debt) => debt.id);
  const relatedPersonIds = [
    ...new Set(
      debts!
        .map((debt) => debt.related_person_id)
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const deletedAt = new Date().toISOString();

  const { error: movementError } = await admin
    .from("movements")
    .update({ deleted_at: deletedAt })
    .eq("user_id", target.userId)
    .in("debt_id", debtIds)
    .is("deleted_at", null);
  if (movementError) throw movementError;

  const { error: debtError } = await admin
    .from("debts")
    .update({ deleted_at: deletedAt })
    .eq("user_id", target.userId)
    .in("id", debtIds)
    .contains("metadata", { qa_fixture: true, qa_run_id: runId });
  if (debtError) throw debtError;

  for (const personId of relatedPersonIds) {
    const { count, error: countError } = await admin
      .from("debts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", target.userId)
      .eq("related_person_id", personId)
      .is("deleted_at", null);
    if (countError) throw countError;
    if ((count ?? 0) === 0) {
      const { error: personError } = await admin
        .from("related_persons")
        .update({ deleted_at: deletedAt })
        .eq("user_id", target.userId)
        .eq("id", personId)
        .is("deleted_at", null);
      if (personError) throw personError;
    }
  }

  print({
    ok: true,
    mode,
    qa_run_id: runId,
    debts_archived: debtIds.length,
    movements_archived: true,
    audit_history_preserved: true,
  });
}

async function reportFixtureStatus() {
  const runId = args.run;
  if (!runId) throw new Error("status requiere --run=UUID.");

  const { data: debts, error: debtError } = await admin
    .from("debts")
    .select("id,name,current_balance,currency,status")
    .eq("user_id", target.userId)
    .is("deleted_at", null)
    .contains("metadata", {
      qa_fixture: true,
      qa_run_id: runId,
      qa_scope: "whatsapp_debt_payment_human_gate",
    })
    .order("name");
  if (debtError) throw debtError;
  if ((debts ?? []).length !== 3) {
    throw new Error(
      `Se esperaban 3 deudas QA activas y se encontraron ${(debts ?? []).length}.`,
    );
  }

  const debtIds = debts!.map((debt) => debt.id);
  const { count: movementCount, error: movementError } = await admin
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", target.userId)
    .in("debt_id", debtIds)
    .is("deleted_at", null);
  if (movementError) throw movementError;

  const { data: installments, error: installmentError } = await admin
    .from("debt_installments")
    .select("debt_id,number,expected_amount,paid_amount,status")
    .eq("user_id", target.userId)
    .in("debt_id", debtIds)
    .order("number");
  if (installmentError) throw installmentError;

  const { data: payments, error: paymentError } = await admin
    .from("debt_payments")
    .select("debt_id,amount,currency,source")
    .eq("user_id", target.userId)
    .in("debt_id", debtIds);
  if (paymentError) throw paymentError;

  const { data: outboxEvents, error: outboxError } = await admin
    .from("transactional_outbox")
    .select("aggregate_id,event_type,status")
    .eq("user_id", target.userId)
    .in("aggregate_id", debtIds)
    .in("event_type", ["debt_payment_registered", "debt_paid"]);
  if (outboxError) throw outboxError;

  const token = runId.slice(0, 8);
  const { data: pendingItems, error: pendingError } = await admin
    .from("pending_items")
    .select("id,metadata")
    .eq("user_id", target.userId)
    .eq("status", "pending");
  if (pendingError) throw pendingError;
  const qaPendingCount = (pendingItems ?? []).filter((item) =>
    normalize(readMetadataString(item.metadata, "original_message") ?? "").includes(
      normalize(token),
    ),
  ).length;

  const { count: captureDraftCount, error: captureError } = await admin
    .from("conversation_memory_states")
    .select("id", { count: "exact", head: true })
    .eq("user_id", target.userId)
    .eq("channel", "whatsapp")
    .eq("scope", "capture_draft");
  if (captureError) throw captureError;

  print({
    ok: true,
    mode,
    qa_run_id: runId,
    debts: debts!.map((debt) => ({
      name: debt.name,
      current_balance: debt.current_balance,
      currency: debt.currency,
      status: debt.status,
    })),
    active_debt_movements: movementCount ?? 0,
    installments: installments ?? [],
    debt_payments: payments ?? [],
    debt_outbox_events: outboxEvents ?? [],
    active_qa_pending_items: qaPendingCount,
    active_capture_drafts: captureDraftCount ?? 0,
  });
}

async function clearCaptureDraft() {
  const { data, error } = await admin
    .from("conversation_memory_states")
    .delete()
    .eq("user_id", target.userId)
    .eq("channel", "whatsapp")
    .eq("scope", "capture_draft")
    .select("id");
  if (error) throw error;

  print({
    ok: true,
    mode,
    capture_drafts_removed: (data ?? []).length,
  });
}

async function discardEventPending() {
  const sourceText = args.text;
  if (!sourceText) {
    throw new Error("discard-event-pending requiere --text=mensaje exacto.");
  }

  const { data: events, error: eventError } = await admin
    .from("external_event_log")
    .select("id,received_at,metadata")
    .eq("source", "whatsapp")
    .eq("user_id", target.userId)
    .gte("received_at", target.receivedAt)
    .order("received_at", { ascending: false })
    .limit(100);
  if (eventError) throw eventError;

  const event = (events ?? []).find(
    (candidate) =>
      normalize(readMetadataString(candidate.metadata, "text") ?? "") ===
      normalize(sourceText),
  );
  if (!event) {
    throw new Error("No se encontro un evento reciente con el texto exacto.");
  }

  const { data: pendingItems, error: pendingError } = await admin
    .from("pending_items")
    .select("id,status,source_ref,metadata")
    .eq("user_id", target.userId)
    .like("source_ref", `whatsapp:${event.id}:%`);
  if (pendingError) throw pendingError;

  const exactPendingItems = (pendingItems ?? []).filter(
    (item) =>
      item.status === "pending" &&
      normalize(readMetadataString(item.metadata, "original_message") ?? "") ===
        normalize(sourceText),
  );
  if (exactPendingItems.length === 0) {
    throw new Error("El evento exacto no tiene Pendientes activos para descartar.");
  }

  for (const item of exactPendingItems) {
    await markPendingDiscarded(
      admin,
      target.userId,
      item.id,
      "qa_human_gate_local_fixture_regression",
      "codex_qa_cleanup",
      event.id,
    );
  }

  print({
    ok: true,
    mode,
    source_event: event.id.slice(0, 8),
    pending_items_discarded: exactPendingItems.length,
    audit_history_preserved: true,
  });
}

function parseArgs(values: string[]) {
  const result: Record<string, string> = {};
  for (const value of values) {
    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) result[match[1]] = match[2];
  }
  return result;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readMetadataString(value: unknown, key: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return readString((value as Record<string, unknown>)[key]);
}

function loadEnv(path: string) {
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

function print(value: unknown) {
  console.log(JSON.stringify(value, null, 2));
}
