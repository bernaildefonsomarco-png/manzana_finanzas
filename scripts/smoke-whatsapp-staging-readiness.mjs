import fs from "node:fs";

const args = new Set(process.argv.slice(2));
const strict =
  args.has("--strict") || process.env.STRICT_WHATSAPP_STAGING === "true";

loadEnv(".env.local");

const env = process.env;
const appEnv = read(env.APP_ENV) ?? "local";
const provider = read(env.WHATSAPP_PROVIDER) ?? "kapso";
const sendResponses = readBoolean(env.WHATSAPP_SEND_RESPONSES);
const executeReadyActions = readBoolean(env.WHATSAPP_EXECUTE_READY_ACTIONS);
const autoDrainOnWebhook = readBoolean(env.OUTBOX_AUTO_DRAIN_ON_WEBHOOK);
const graphVersion = read(env.WHATSAPP_GRAPH_VERSION) ?? "v25.0";
const appUrl = read(env.MANZANA_APP_URL) ?? read(env.NEXT_PUBLIC_MANZANA_APP_URL);
const verifyToken =
  read(env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) ?? read(env.WHATSAPP_VERIFY_TOKEN);

const blockers = [];
const warnings = [];
const checks = [];

checkRequired("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
checkRequired(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  read(env.NEXT_PUBLIC_SUPABASE_ANON_KEY) ??
    read(env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
);
checkRequired("SUPABASE_SERVICE_ROLE_KEY", env.SUPABASE_SERVICE_ROLE_KEY);

if (!["local", "preview", "staging", "production"].includes(appEnv)) {
  blockers.push(`APP_ENV invalido: ${appEnv}`);
} else {
  checks.push(`APP_ENV=${appEnv}`);
}

if (!["kapso", "meta_cloud", "ycloud"].includes(provider)) {
  blockers.push(`WHATSAPP_PROVIDER invalido: ${provider}`);
} else {
  checks.push(`WHATSAPP_PROVIDER=${provider}`);
}

const stagingIntent = strict || appEnv === "staging" || sendResponses;

if (stagingIntent) {
  checkRequired("MANZANA_APP_URL or NEXT_PUBLIC_MANZANA_APP_URL", appUrl);
  checkRequired("WORKER_SECRET", env.WORKER_SECRET);
  checkProviderCredentials(provider);

  if (appUrl && !isValidHttpsUrl(appUrl)) {
    blockers.push(
      "MANZANA_APP_URL/NEXT_PUBLIC_MANZANA_APP_URL debe ser una URL https publica para staging."
    );
  }

  if (appEnv !== "staging") {
    blockers.push(
      "Para validar envio real, usa APP_ENV=staging. No actives staging desde local/preview/production."
    );
  }

  if (!sendResponses) {
    blockers.push(
      "WHATSAPP_SEND_RESPONSES debe ser true solo cuando quieras probar envio real en staging."
    );
  }

  if (!autoDrainOnWebhook) {
    warnings.push(
      "OUTBOX_AUTO_DRAIN_ON_WEBHOOK esta false; los webhooks requeriran worker externo para responder rapido."
    );
  } else {
    checks.push("OUTBOX_AUTO_DRAIN_ON_WEBHOOK=true");
  }

  if (!executeReadyActions) {
    warnings.push(
      "WHATSAPP_EXECUTE_READY_ACTIONS esta false; el registro natural no ejecutara acciones ready_for_core fuera de local."
    );
  }
} else {
  warnings.push(
    "Modo local seguro: credenciales incompletas o WHATSAPP_SEND_RESPONSES=false, asi que no se enviara nada real."
  );

  if (appUrl && !isValidUrl(appUrl)) {
    warnings.push("MANZANA_APP_URL/NEXT_PUBLIC_MANZANA_APP_URL no parece URL valida.");
  }
}

if (sendResponses && appEnv === "production") {
  blockers.push(
    "WHATSAPP_SEND_RESPONSES=true en production queda bloqueado por este readiness check. Primero valida staging."
  );
}

if (sendResponses && appEnv === "local" && env.ALLOW_LOCAL_WHATSAPP_SEND !== "true") {
  blockers.push(
    "WHATSAPP_SEND_RESPONSES=true en local es riesgoso. Usa APP_ENV=staging o ALLOW_LOCAL_WHATSAPP_SEND=true solo para pruebas controladas."
  );
}

const ready = blockers.length === 0 && stagingIntent;
const ok = blockers.length === 0 || (!strict && appEnv === "local" && !sendResponses);

const result = {
  ok,
  staging_ready: ready,
  strict,
  app_env: appEnv,
  whatsapp_provider: provider,
  send_responses_enabled: sendResponses,
  execute_ready_actions_enabled: executeReadyActions,
  outbox_auto_drain_on_webhook_enabled: autoDrainOnWebhook,
  app_url_configured: Boolean(appUrl),
  webhook_signature_required: appEnv === "staging" || appEnv === "production",
  blockers,
  warnings,
  checks,
};

console.log(JSON.stringify(result, null, 2));

if (!ok) {
  process.exitCode = 1;
}

function checkProviderCredentials(currentProvider) {
  if (currentProvider === "kapso") {
    checkRequired("KAPSO_API_KEY", env.KAPSO_API_KEY);
    checkRequired(
      "KAPSO_WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_PHONE_NUMBER_ID",
      read(env.KAPSO_WHATSAPP_PHONE_NUMBER_ID) ?? read(env.WHATSAPP_PHONE_NUMBER_ID)
    );
    checkRequired("KAPSO_WEBHOOK_SECRET", env.KAPSO_WEBHOOK_SECRET);
    return;
  }

  if (currentProvider === "meta_cloud") {
    checkRequired("WHATSAPP_TOKEN", env.WHATSAPP_TOKEN);
    checkRequired("WHATSAPP_PHONE_NUMBER_ID", env.WHATSAPP_PHONE_NUMBER_ID);
    checkRequired("WHATSAPP_APP_SECRET", env.WHATSAPP_APP_SECRET);
    checkRequired(
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN or WHATSAPP_VERIFY_TOKEN",
      verifyToken
    );

    if (graphVersion && /^v\d+\.\d+$/.test(graphVersion)) {
      checks.push(`WHATSAPP_GRAPH_VERSION=${graphVersion}`);
    } else {
      blockers.push("WHATSAPP_GRAPH_VERSION debe tener formato tipo v25.0");
    }
    return;
  }

  if (currentProvider === "ycloud") {
    checkRequired("YCLOUD_API_KEY", env.YCLOUD_API_KEY);
    checkRequired("YCLOUD_WHATSAPP_FROM_PHONE", env.YCLOUD_WHATSAPP_FROM_PHONE);
    checkRequired("YCLOUD_WEBHOOK_SECRET", env.YCLOUD_WEBHOOK_SECRET);
  }
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

function checkRequired(name, value) {
  const clean = read(value);
  if (!clean || isPlaceholder(clean)) {
    blockers.push(`${name} requerido para staging WhatsApp.`);
    return;
  }

  checks.push(`${name}=configured`);
}

function read(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readBoolean(value) {
  return value === "true";
}

function isPlaceholder(value) {
  return /^(your-|replace-|changeme|todo|test-|dummy|example)/i.test(value);
}

function isValidUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function isValidHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isLocalhost(url.hostname);
  } catch {
    return false;
  }
}

function isLocalhost(hostname) {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".local")
  );
}
