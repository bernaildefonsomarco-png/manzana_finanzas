import fs from "node:fs";

const args = parseArgs(process.argv.slice(2));
loadEnv(".env.local");

const baseUrl = (
  args["base-url"] ??
  process.env.MANZANA_APP_URL ??
  process.env.NEXT_PUBLIC_MANZANA_APP_URL ??
  "https://manzana.website"
).replace(/\/$/, "");
const secret = process.env.CRON_SECRET ?? process.env.WORKER_SECRET;
const userId = args["user-id"] ?? process.env.PROACTIVE_NUDGE_PILOT_USER_ID;
const windowDays = Number(args["window-days"] ?? 7);
const requireReady = args["require-ready"] === "true";
const requireActive = args["require-active"] === "true";

if (!secret) fail("CRON_SECRET o WORKER_SECRET requerido.");
if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 31) {
  fail("window-days debe ser entero entre 1 y 31.");
}

const url = new URL(`${baseUrl}/api/internal/jobs/nudges-readiness`);
url.searchParams.set("window_days", String(windowDays));
if (userId) url.searchParams.set("user_id", userId);

const response = await fetch(url, {
  headers: { authorization: `Bearer ${secret}` },
});
const text = await response.text();
const payload = parseJson(text);

if (!response.ok || payload?.ok !== true) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        status: response.status,
        endpoint: url.toString(),
        response: payload ?? text.slice(0, 1_000),
      },
      null,
      2,
    ),
  );
  process.exit(1);
}

const data = payload.data;
const gateFailed =
  (requireReady && data.global?.configuration_ready !== true) ||
  (requireActive && data.global?.sending_active !== true);
console.log(
  JSON.stringify(
    {
      ok: !gateFailed,
      status: response.status,
      read_only: data.read_only,
      provider: data.provider,
      activation: data.activation,
      global: data.global,
      template: data.template,
      user: data.user,
      metrics: data.metrics,
    },
    null,
    2,
  ),
);
if (gateFailed) process.exitCode = 2;

function parseArgs(values) {
  const parsed = {};
  for (const value of values) {
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

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function fail(message) {
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
}
