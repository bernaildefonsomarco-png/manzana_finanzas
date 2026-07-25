import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const args = parseArgs(process.argv.slice(2));

loadEnv(".env.local");

const strict =
  Boolean(args.strict) || process.env.RUN_WHATSAPP_AGENT_TRACE_SMOKE === "true";
const verbose = Boolean(args.verbose);
const debtPaymentAudit = Boolean(args["debt-payment"]);
const hours = readNumber(args.hours ?? process.env.WHATSAPP_AGENT_TRACE_HOURS, 24);
const limit = readNumber(args.limit ?? process.env.WHATSAPP_AGENT_TRACE_LIMIT, 80);
const sinceOverride = readIsoDate(
  args.since ?? process.env.WHATSAPP_AGENT_TRACE_SINCE
);
const expectedProvider =
  readString(args["expected-provider"]) ??
  readString(process.env.WHATSAPP_AGENT_TRACE_EXPECTED_PROVIDER) ??
  "api";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const phoneFilter = normalizePhone(
  readString(args.phone) ?? readString(process.env.WHATSAPP_AGENT_TRACE_PHONE)
);
const handshakeFilter = readString(args.handshake);

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing Supabase local env vars.");
}

if (!Number.isFinite(hours) || hours <= 0) {
  throw new Error("hours debe ser un numero positivo.");
}

if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
  throw new Error("limit debe ser entero entre 1 y 500.");
}

async function main() {
const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const since =
  sinceOverride ?? new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
const { data, error } = await admin
  .from("external_event_log")
  .select("id,received_at,status,user_id,idempotency_key,metadata")
  .eq("source", "whatsapp")
  .gte("received_at", since)
  .order("received_at", { ascending: false })
  .limit(limit);

if (error) throw error;

const rows = data ?? [];
const handshakeEvent = handshakeFilter
  ? rows.find(
      (event) =>
        normalizedText(event).trim() === normalizeText(handshakeFilter).trim() &&
        event.user_id
    )
  : null;
const handshakeUserId = handshakeEvent?.user_id ?? null;
const inboundEvents = rows
  .filter(isInboundUserMessage)
  .filter((event) =>
    phoneFilter
      ? normalizePhone(readString(event.metadata?.from_phone)) === phoneFilter
      : handshakeFilter
        ? event.user_id === handshakeUserId
        : true
  );
const events = debtPaymentAudit
  ? inboundEvents.filter(isDebtPaymentEvent)
  : inboundEvents;

const blockers = [];
const warnings = [];

if (handshakeFilter && !handshakeUserId) {
  blockers.push("No se encontro el handshake para identificar la cuenta QA.");
}

if (events.length === 0) {
  blockers.push(
    phoneFilter
      ? "No hay eventos recientes de WhatsApp para el telefono filtrado."
      : "No hay eventos recientes de WhatsApp para auditar."
  );
}

const sendableEvents = events.filter(isSendableResponseEvent);
const dataAgentApiEvents = events.filter(
  (event) =>
    event.metadata?.data_agent_status === "completed" &&
    event.metadata?.agent_runtime_provider === expectedProvider
);
const responseAgentCompletedByProvider = countBy(
  sendableEvents.filter((event) => event.metadata?.response_agent_status === "completed"),
  (event) => readString(event.metadata?.response_agent_provider) ?? "unknown"
);
const responseAgentApiEvents = sendableEvents.filter(
  (event) =>
    event.metadata?.response_agent_status === "completed" &&
    event.metadata?.response_agent_provider === expectedProvider
);
const debtPaymentQuality = buildDebtPaymentQuality(events, expectedProvider);

if (debtPaymentAudit) {
  for (const scenario of debtPaymentQuality.missing_scenarios) {
    const message = `No se encontro escenario de pago de deuda: ${scenario}.`;
    if (strict) blockers.push(message);
    else warnings.push(message);
  }

  for (const violation of debtPaymentQuality.safety_violations) {
    blockers.push(`Violacion financiera ${violation.code} en ${violation.event_id}.`);
  }

  if (debtPaymentQuality.fallback_events > 0) {
    const attemptLabel =
      debtPaymentQuality.fallback_events === 1 ? "intento" : "intentos";
    const providerVerb =
      debtPaymentQuality.fallback_events === 1 ? "uso" : "usaron";
    const qualifyVerb =
      debtPaymentQuality.fallback_events === 1 ? "califica" : "califican";
    warnings.push(
      `${debtPaymentQuality.fallback_events} ${attemptLabel} de pago de deuda ${providerVerb} un provider distinto de ${expectedProvider}; no ${qualifyVerb} como evidencia de escenario.`
    );
  }
}

if (events.length > 0 && dataAgentApiEvents.length === 0) {
  warnings.push(
    `No se encontro ningun evento reciente con DataAgent usando ${expectedProvider}.`
  );
}

if (sendableEvents.length > 0 && responseAgentApiEvents.length === 0) {
  const message = `No se encontro ninguna respuesta sendable reciente con ResponseAgent completado usando ${expectedProvider}.`;
  if (strict) blockers.push(message);
  else warnings.push(message);
}

for (const event of sendableEvents) {
  const responseStatus = readString(event.metadata?.response_agent_status);
  if (!responseStatus || responseStatus === "not_applicable") {
    const message = `Evento sendable ${shortId(event.id)} no paso por ResponseAgent.`;
    if (strict) blockers.push(message);
    else warnings.push(message);
  }

  if (responseStatus === "failed") {
    const message = `ResponseAgent fallo en evento ${shortId(event.id)}.`;
    if (strict) blockers.push(message);
    else warnings.push(message);
  }
}

const scenarios = Object.fromEntries(
  (debtPaymentAudit ? [] : SCENARIOS).map((scenario) => {
    const event = events.find((candidate) => scenario.match(candidate));
    const result = event
      ? validateScenario(scenario, event)
      : {
          found: false,
          checks: [],
          warnings: [
            `No se encontro escenario "${scenario.name}" en las ultimas ${hours}h.`,
          ],
        };

    for (const warning of result.warnings ?? []) {
      if (strict && scenario.requiredInStrict) blockers.push(warning);
      else warnings.push(warning);
    }

    for (const blocker of result.blockers ?? []) {
      if (strict) blockers.push(blocker);
      else warnings.push(blocker);
    }

    return [scenario.key, result];
  })
);

const output = {
  ok: blockers.length === 0,
  mode: strict ? "strict" : "readiness",
  audit_scope: debtPaymentAudit ? "debt_payment" : "conversation",
  since,
  scanned: rows.length,
  inbound_events: inboundEvents.length,
  eligible_events: events.length,
  identity_filter: phoneFilter
    ? "phone"
    : handshakeFilter
      ? "handshake"
      : "none",
  phone_filter_applied: Boolean(phoneFilter),
  expected_provider: expectedProvider,
  summary: {
    sendable_events: sendableEvents.length,
    data_agent_expected_provider_events: dataAgentApiEvents.length,
    response_agent_expected_provider_events: responseAgentApiEvents.length,
    response_agent_completed_by_provider: responseAgentCompletedByProvider,
  },
  debt_payment_quality: debtPaymentAudit ? debtPaymentQuality : undefined,
  event_previews: verbose
    ? events.map((event) => ({
        event_id: shortId(event.id),
        received_at: event.received_at,
        text: readString(event.metadata?.text),
        orchestrator_reason: event.metadata?.orchestrator_reason ?? null,
        data_agent_provider: event.metadata?.agent_runtime_provider ?? null,
        financial_action_plan_kind:
          event.metadata?.financial_action_plan_kind ?? null,
        financial_action_execution_kind:
          event.metadata?.financial_action_execution_kind ?? null,
        response_plan_reason: event.metadata?.response_plan_reason ?? null,
        response_agent_status: event.metadata?.response_agent_status ?? null,
        response_agent_provider: event.metadata?.response_agent_provider ?? null,
        response_agent_reason: event.metadata?.response_agent_reason ?? null,
        response_agent_safety_flags:
          event.metadata?.response_agent_safety_flags ?? [],
      }))
    : undefined,
  scenarios,
  warnings,
  blockers,
};

console.log(JSON.stringify(output, null, 2));

if (blockers.length > 0) {
  process.exitCode = 1;
}
}

function validateScenario(scenario, event) {
  const metadata = event.metadata ?? {};
  const checks = [];
  const scenarioWarnings = [];
  const scenarioBlockers = [];

  addCheck(checks, "orchestrator accepted", metadata.orchestrator_status === "accepted", {
    expected: "accepted",
    actual: metadata.orchestrator_status ?? null,
    blockers: scenarioBlockers,
  });

  if (scenario.expectsDataAgent) {
    addCheck(checks, "DataAgent completed", metadata.data_agent_status === "completed", {
      expected: "completed",
      actual: metadata.data_agent_status ?? null,
      blockers: scenarioBlockers,
    });
    addProviderCheck({
      checks,
      warnings: scenarioWarnings,
      blockers: scenarioBlockers,
      label: "DataAgent provider",
      actual: readString(metadata.agent_runtime_provider),
      expected: expectedProvider,
    });
  }

  if (scenario.expectsSendableResponse) {
    addCheck(checks, "response is sendable", isSendableResponseEvent(event), {
      expected: "whatsapp_freeform or whatsapp_interactive with text",
      actual: {
        response_plan_kind: metadata.response_plan_kind ?? null,
        response_plan_reason: metadata.response_plan_reason ?? null,
      },
      blockers: scenarioBlockers,
    });
    addResponseAgentChecks({
      checks,
      warnings: scenarioWarnings,
      blockers: scenarioBlockers,
      event,
    });
  }

  scenario.validate?.({
    event,
    metadata,
    checks,
    warnings: scenarioWarnings,
    blockers: scenarioBlockers,
  });

  return {
    found: true,
    received_at: event.received_at,
    event_id: shortId(event.id),
    text: verbose ? readString(metadata.text) : scenario.name,
    orchestrator_reason: metadata.orchestrator_reason ?? null,
    response_plan_reason: metadata.response_plan_reason ?? null,
    data_agent_provider: metadata.agent_runtime_provider ?? null,
    data_agent_model: metadata.agent_runtime_model ?? null,
    response_agent_status: metadata.response_agent_status ?? null,
    response_agent_provider: metadata.response_agent_provider ?? null,
    response_agent_model: metadata.response_agent_model ?? null,
    response_preview: verbose ? readString(metadata.response_plan_text) : undefined,
    checks,
    warnings: scenarioWarnings,
    blockers: scenarioBlockers,
  };
}

function addResponseAgentChecks({ checks, warnings, blockers, event }) {
  const metadata = event.metadata ?? {};
  const status = readString(metadata.response_agent_status);
  addCheck(checks, "ResponseAgent status captured", Boolean(status), {
    expected: "completed, rejected or failed",
    actual: status,
    blockers,
  });

  if (status === "not_applicable") {
    blockers.push(`ResponseAgent no aplico en evento ${shortId(event.id)}.`);
  }

  if (status === "failed") {
    blockers.push(`ResponseAgent fallo en evento ${shortId(event.id)}.`);
  }

  if (status === "rejected") {
    warnings.push(
      `ResponseAgent fue rechazado por guardrail (${metadata.response_agent_reason ?? "unknown"}).`
    );
  }

  if (status === "completed") {
    addProviderCheck({
      checks,
      warnings,
      blockers,
      label: "ResponseAgent provider",
      actual: readString(metadata.response_agent_provider),
      expected: expectedProvider,
    });
  }
}

function addProviderCheck({ checks, warnings, blockers, label, actual, expected }) {
  const ok = actual === expected;
  checks.push({ label, ok, expected, actual: actual ?? null });
  if (!ok) {
    const message = `${label}: esperado ${expected}, recibido ${actual ?? "null"}.`;
    if (strict) blockers.push(message);
    else warnings.push(message);
  }
}

function addCheck(checks, label, ok, details) {
  checks.push({
    label,
    ok,
    expected: details.expected,
    actual: details.actual,
  });
  if (!ok) {
    details.blockers.push(
      `${label}: esperado ${JSON.stringify(details.expected)}, recibido ${JSON.stringify(
        details.actual
      )}.`
    );
  }
}

function isInboundUserMessage(event) {
  const metadata = event.metadata ?? {};
  const text = readString(metadata.text);
  const idempotencyKey = readString(event.idempotency_key) ?? "";
  if (!text) return false;
  if (!event.user_id) return false;
  if (idempotencyKey.includes("smoke")) return false;
  return ["text", "button", "interactive"].includes(
    readString(metadata.message_type) ?? "text"
  );
}

function isSendableResponseEvent(event) {
  const metadata = event.metadata ?? {};
  return (
    (metadata.response_plan_kind === "whatsapp_freeform" ||
      metadata.response_plan_kind === "whatsapp_interactive") &&
    Boolean(readString(metadata.response_plan_text))
  );
}

function isDebtPaymentEvent(event) {
  const metadata = event.metadata ?? {};
  const actions = Array.isArray(metadata.financial_action_plan_actions)
    ? metadata.financial_action_plan_actions
    : [];
  const movements = Array.isArray(metadata.financial_action_execution_movements)
    ? metadata.financial_action_execution_movements
    : [];
  return (
    actions.some((action) =>
      readReasons(action).some(
        (reason) =>
          reason.startsWith("debt_") || reason === "safe_specialized_debt_payment"
      )
    ) ||
    movements.some((movement) =>
      ["pago_deuda", "devolucion_recibida"].includes(
        readString(movement?.movement_type) ?? ""
      )
    )
  );
}

function buildDebtPaymentQuality(events, expected) {
  const partialEvents = [];
  const fullEvents = [];
  const safetyViolations = [];
  const allReasons = [];
  const providerQualifiedReasons = [];
  const dataLatencies = [];
  const responseLatencies = [];
  let executedEvents = 0;
  let blockedEvents = 0;
  let fallbackEvents = 0;
  let dataAgentFallbackEvents = 0;
  let responseAgentFallbackEvents = 0;
  let providerQualifiedEvents = 0;
  let accountlessExecutions = 0;
  let accountLinkedExecutions = 0;

  for (const event of events) {
    const metadata = event.metadata ?? {};
    const actions = Array.isArray(metadata.financial_action_plan_actions)
      ? metadata.financial_action_plan_actions
      : [];
    const movements = Array.isArray(metadata.financial_action_execution_movements)
      ? metadata.financial_action_execution_movements
      : [];
    const reasons = actions.flatMap(readReasons);
    allReasons.push(...reasons);
    const dataAgentQualified =
      metadata.data_agent_status === "completed" &&
      metadata.agent_runtime_provider === expected;
    const responseAgentQualified =
      metadata.response_agent_status === "completed" &&
      metadata.response_agent_provider === expected;
    const providerQualified = dataAgentQualified && responseAgentQualified;
    if (providerQualified) {
      providerQualifiedEvents += 1;
      providerQualifiedReasons.push(...reasons);
    }

    if (metadata.financial_action_execution_kind === "executed") {
      executedEvents += 1;
    }
    if (metadata.financial_action_plan_kind === "blocked") blockedEvents += 1;
    if (!dataAgentQualified) dataAgentFallbackEvents += 1;
    if (!responseAgentQualified) responseAgentFallbackEvents += 1;
    if (!providerQualified) fallbackEvents += 1;

    const dataLatency = readFiniteNumber(metadata.agent_runtime_latency_ms);
    const responseLatency = readFiniteNumber(metadata.response_agent_latency_ms);
    if (dataLatency !== null) dataLatencies.push(dataLatency);
    if (responseLatency !== null) responseLatencies.push(responseLatency);

    for (const movement of movements) {
      if (
        !["pago_deuda", "devolucion_recibida"].includes(
          readString(movement?.movement_type) ?? ""
        )
      ) {
        continue;
      }
      const remaining = readFiniteNumber(movement.debt_remaining_balance);
      if (providerQualified && remaining === 0) fullEvents.push(event);
      if (providerQualified && remaining !== null && remaining > 0) {
        partialEvents.push(event);
      }
      if (movement.account_origin_id || movement.account_destination_id) {
        accountLinkedExecutions += 1;
      } else {
        accountlessExecutions += 1;
      }
    }

    if (
      metadata.financial_action_execution_kind === "executed" &&
      metadata.financial_action_plan_kind !== "ready_for_core"
    ) {
      safetyViolations.push({
        event_id: shortId(event.id),
        code: "execution_without_ready_plan",
      });
    }
    if (
      metadata.financial_action_plan_kind === "blocked" &&
      numberFrom(metadata.pending_creation_created_count) > 0
    ) {
      safetyViolations.push({
        event_id: shortId(event.id),
        code: "blocked_payment_created_pending",
      });
    }
    if (
      metadata.financial_action_plan_kind === "blocked" &&
      numberFrom(metadata.financial_action_execution_created_count) > 0
    ) {
      safetyViolations.push({
        event_id: shortId(event.id),
        code: "blocked_payment_mutated_core",
      });
    }
  }

  const coverage = {
    partial_payment_executed: partialEvents.length > 0,
    full_payment_executed: fullEvents.length > 0,
    ambiguous_debt_blocked: providerQualifiedReasons.includes(
      "debt_reference_ambiguous"
    ),
    overpayment_blocked: providerQualifiedReasons.includes(
      "debt_payment_exceeds_balance"
    ),
    currency_mismatch_blocked: providerQualifiedReasons.includes(
      "debt_payment_currency_mismatch"
    ),
  };

  return {
    events: events.length,
    executed_events: executedEvents,
    blocked_events: blockedEvents,
    provider_qualified_events: providerQualifiedEvents,
    fallback_events: fallbackEvents,
    data_agent_fallback_events: dataAgentFallbackEvents,
    response_agent_fallback_events: responseAgentFallbackEvents,
    accountless_executions: accountlessExecutions,
    account_linked_executions: accountLinkedExecutions,
    plan_kinds: countBy(
      events,
      (event) => readString(event.metadata?.financial_action_plan_kind) ?? "none"
    ),
    execution_kinds: countBy(
      events,
      (event) =>
        readString(event.metadata?.financial_action_execution_kind) ?? "none"
    ),
    data_agent_providers: countBy(
      events,
      (event) => readString(event.metadata?.agent_runtime_provider) ?? "none"
    ),
    response_agent_providers: countBy(
      events,
      (event) => readString(event.metadata?.response_agent_provider) ?? "none"
    ),
    response_agent_statuses: countBy(
      events,
      (event) => readString(event.metadata?.response_agent_status) ?? "none"
    ),
    response_agent_rejections: countBy(
      events.filter(
        (event) => event.metadata?.response_agent_status === "rejected"
      ),
      (event) => readString(event.metadata?.response_agent_reason) ?? "unknown"
    ),
    blocked_reasons: countBy(allReasons, (reason) => reason),
    latency_ms: {
      data_agent: percentileSummary(dataLatencies),
      response_agent: percentileSummary(responseLatencies),
    },
    scenario_coverage: coverage,
    missing_scenarios: Object.entries(coverage)
      .filter(([, found]) => !found)
      .map(([scenario]) => scenario),
    safety_violations: safetyViolations,
  };
}

function parseArgs(values) {
  const parsed = {};

  for (const value of values) {
    if (value === "--strict") {
      parsed.strict = "true";
      continue;
    }
    if (value === "--verbose") {
      parsed.verbose = "true";
      continue;
    }
    if (value === "--debt-payment") {
      parsed["debt-payment"] = "true";
      continue;
    }

    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) parsed[match[1]] = match[2];
  }

  return parsed;
}

function loadEnv(path) {
  if (!fs.existsSync(path)) return;

  const raw = fs.readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    process.env[trimmed.slice(0, separator)] ??= trimmed.slice(separator + 1);
  }
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readNumber(value, fallback) {
  const clean = readString(value);
  if (!clean) return fallback;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readIsoDate(value) {
  const clean = readString(value);
  if (!clean) return null;
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("since debe ser una fecha ISO valida.");
  }
  return parsed.toISOString();
}

function readFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePhone(value) {
  const clean = readString(value);
  if (!clean) return null;
  const digits = clean.replace(/\D/g, "");
  return digits ? `+${digits}` : null;
}

function shortId(value) {
  return String(value).slice(0, 8);
}

function countBy(values, keyFn) {
  return values.reduce((acc, value) => {
    const key = keyFn(value);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function readReasons(action) {
  return Array.isArray(action?.reasons)
    ? action.reasons.filter((reason) => typeof reason === "string")
    : [];
}

function percentileSummary(values) {
  if (values.length === 0) return { count: 0, p50: null, p95: null };
  const sorted = [...values].sort((left, right) => left - right);
  return {
    count: sorted.length,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
  };
}

function percentile(sorted, ratio) {
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil(sorted.length * ratio) - 1)
  );
  return sorted[index];
}

function normalizedText(event) {
  return normalizeText(event.metadata?.text ?? "");
}

function normalizeText(value) {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function numberFrom(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

const SCENARIOS = [
  {
    key: "conversation_greeting",
    name: "hola",
    requiredInStrict: true,
    expectsDataAgent: true,
    expectsSendableResponse: true,
    match: (event) => /^(hola|ola|holi|buenas|hey|manzana)[.!?]*$/.test(
      normalizedText(event)
    ),
    validate: ({ metadata, checks, blockers }) => {
      addCheck(checks, "conversation greeting response captured", metadata.response_plan_reason === "conversation_greeting", {
        expected: "conversation_greeting",
        actual: metadata.response_plan_reason ?? null,
        blockers,
      });
      addCheck(checks, "conversation greeting did not create money movement", numberFrom(metadata.financial_action_execution_created_count) === 0, {
        expected: 0,
        actual: numberFrom(metadata.financial_action_execution_created_count),
        blockers,
      });
      addCheck(checks, "conversation greeting did not create pending item", numberFrom(metadata.pending_creation_created_count) === 0, {
        expected: 0,
        actual: numberFrom(metadata.pending_creation_created_count),
        blockers,
      });
    },
  },
  {
    key: "simple_register",
    name: "gaste 10 en desayuno",
    requiredInStrict: true,
    expectsDataAgent: true,
    expectsSendableResponse: true,
    match: (event) => /gaste\s+10\b.*desayuno/.test(normalizedText(event)),
    validate: ({ metadata, checks, blockers }) => {
      const accepted =
        metadata.orchestrator_reason === "accepted_with_core_execution" ||
        metadata.orchestrator_reason === "accepted_with_pending_confirmation";
      addCheck(checks, "clear register reached Core or Pending", accepted, {
        expected: "core_execution or pending_confirmation",
        actual: metadata.orchestrator_reason ?? null,
        blockers,
      });
    },
  },
  {
    key: "multi_register",
    name: "gaste 8 cafe, 15 taxi y 20 almuerzo",
    requiredInStrict: true,
    expectsDataAgent: true,
    expectsSendableResponse: true,
    match: (event) => {
      const text = normalizedText(event);
      return (
        /gaste/.test(text) &&
        /\b8\b/.test(text) &&
        /cafe/.test(text) &&
        /\b15\b/.test(text) &&
        /taxi/.test(text) &&
        /\b20\b/.test(text) &&
        /almuerzo/.test(text)
      );
    },
    validate: ({ metadata, checks, blockers }) => {
      const count = Math.max(
        numberFrom(metadata.proposed_actions_count),
        numberFrom(metadata.financial_action_execution_created_count),
        numberFrom(metadata.pending_creation_created_count)
      );
      addCheck(checks, "multi register has at least 3 actions", count >= 3, {
        expected: ">= 3",
        actual: count,
        blockers,
      });
    },
  },
  {
    key: "ambiguous_register",
    name: "creo que gaste algo pero no recuerdo cuanto",
    requiredInStrict: true,
    expectsDataAgent: true,
    expectsSendableResponse: true,
    match: (event) => {
      const text = normalizedText(event);
      return /creo que/.test(text) && /gaste/.test(text) && /no recuerdo/.test(text);
    },
    validate: ({ metadata, checks, blockers }) => {
      const created = numberFrom(metadata.financial_action_execution_created_count);
      addCheck(checks, "ambiguous register did not create money movement", created === 0, {
        expected: 0,
        actual: created,
        blockers,
      });
    },
  },
  {
    key: "correction_loan_to",
    name: "eso no fue gasto, fue prestamo a Luis",
    requiredInStrict: true,
    expectsDataAgent: true,
    expectsSendableResponse: true,
    match: (event) => {
      const text = normalizedText(event);
      return /eso no fue/.test(text) && /gasto/.test(text) && /prestamo/.test(text);
    },
    validate: ({ metadata, checks, blockers }) => {
      const hasCorrectionPath =
        Boolean(metadata.correction_agent_status) ||
        Boolean(metadata.correction_resolution_kind);
      addCheck(checks, "correction path captured", hasCorrectionPath, {
        expected: "correction_agent_status or correction_resolution_kind",
        actual: {
          correction_agent_status: metadata.correction_agent_status ?? null,
          correction_resolution_kind: metadata.correction_resolution_kind ?? null,
        },
        blockers,
      });
    },
  },
  {
    key: "pending_list",
    name: "ver pendientes",
    requiredInStrict: true,
    expectsDataAgent: false,
    expectsSendableResponse: true,
    match: (event) => /ver pendientes/.test(normalizedText(event)),
    validate: ({ metadata, checks, blockers }) => {
      addCheck(checks, "pending list path captured", metadata.pending_resolution_kind === "listed", {
        expected: "listed",
        actual: metadata.pending_resolution_kind ?? null,
        blockers,
      });
    },
  },
];

await main();
