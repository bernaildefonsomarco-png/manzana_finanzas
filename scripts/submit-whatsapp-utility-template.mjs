import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

loadEnv(".env.local");

const submit = process.argv.includes("--submit");
const emailPending = process.argv.includes("--email-pending");
const apiKey = process.env.KAPSO_API_KEY;
const phoneNumberId = process.env.KAPSO_WHATSAPP_PHONE_NUMBER_ID;
const configuredBusinessAccountId =
  process.env.KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID ??
  process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const metaBaseUrl = (
  process.env.KAPSO_API_BASE_URL ??
  "https://api.kapso.ai/meta/whatsapp/v24.0"
).replace(/\/$/, "");
const platformBaseUrl = "https://api.kapso.ai/platform/v1";
const templatePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  emailPending
    ? "../src/core/pending/templates/manzana_movimiento_por_confirmar_v1.json"
    : "../src/core/nudges/templates/manzana_compromiso_financiero_v1.json",
);
const template = JSON.parse(fs.readFileSync(templatePath, "utf8"));

if (!apiKey) fail("Falta KAPSO_API_KEY.");
if (!phoneNumberId && !configuredBusinessAccountId) {
  fail(
    "Falta KAPSO_WHATSAPP_PHONE_NUMBER_ID o KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID.",
  );
}

const businessAccountId =
  configuredBusinessAccountId ?? (await discoverBusinessAccountId());
const existing = await findExistingTemplate(businessAccountId);

if (existing) {
  printResult({
    action: "existing",
    business_account_id: businessAccountId,
    template: safeTemplate(existing),
  });
} else if (!submit) {
  printResult({
    action: "preview",
    business_account_id: businessAccountId,
    endpoint: `${metaBaseUrl}/${businessAccountId}/message_templates`,
    template,
  });
} else {
  const response = await fetch(
    `${metaBaseUrl}/${businessAccountId}/message_templates`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify(template),
    },
  );
  const body = await readJson(response);

  if (!response.ok) {
    fail(`Kapso rechazo la plantilla con HTTP ${response.status}.`, body);
  }

  printResult({
    action: "submitted",
    business_account_id: businessAccountId,
    template: {
      id: readString(body?.id),
      name: template.name,
      language: template.language,
      category: readString(body?.category) ?? template.category,
      status: readString(body?.status) ?? "PENDING",
    },
  });
}

async function discoverBusinessAccountId() {
  const response = await fetch(
    `${platformBaseUrl}/whatsapp/phone_numbers/${phoneNumberId}`,
    { headers: { "X-API-Key": apiKey } },
  );
  const body = await readJson(response);
  if (!response.ok) {
    fail(`No se pudo consultar el numero en Kapso (HTTP ${response.status}).`, body);
  }
  const value = readString(body?.data?.business_account_id);
  if (!value) fail("Kapso no devolvio business_account_id para el numero.");
  return value;
}

async function findExistingTemplate(businessAccountId) {
  const url = new URL(
    `${metaBaseUrl}/${businessAccountId}/message_templates`,
  );
  url.searchParams.set("name", template.name);
  url.searchParams.set("language", template.language);
  url.searchParams.set("limit", "20");
  const response = await fetch(url, {
    headers: { "X-API-Key": apiKey },
  });
  const body = await readJson(response);
  if (!response.ok) {
    fail(`No se pudieron listar plantillas (HTTP ${response.status}).`, body);
  }
  return Array.isArray(body?.data)
    ? body.data.find(
        (entry) =>
          entry?.name === template.name && entry?.language === template.language,
      )
    : null;
}

function safeTemplate(value) {
  return {
    id: readString(value?.id),
    name: readString(value?.name),
    language: readString(value?.language),
    category: readString(value?.category),
    status: readString(value?.status),
  };
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw_text: text.slice(0, 1_000) };
  }
}

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    process.env[trimmed.slice(0, separator)] ??= trimmed.slice(separator + 1);
  }
}

function printResult(value) {
  console.log(JSON.stringify({ ok: true, ...value }, null, 2));
}

function fail(message, details) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        error: message,
        ...(details ? { details } : {}),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}
