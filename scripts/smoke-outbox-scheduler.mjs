import fs from "node:fs";

const args = parseArgs(process.argv.slice(2));

loadEnv(".env.local");

const baseUrl = (
  args["base-url"] ??
  process.env.MANZANA_APP_URL ??
  process.env.NEXT_PUBLIC_MANZANA_APP_URL ??
  "https://manzana.website"
).replace(/\/$/, "");
const limit = Number(args.limit ?? process.env.OUTBOX_SCHEDULER_SMOKE_LIMIT ?? 1);
const includeSnapshot = args.snapshot !== "false";
const run = Boolean(args.run) || process.env.RUN_OUTBOX_SCHEDULER_SMOKE === "true";
const cronSecret = process.env.CRON_SECRET ?? process.env.WORKER_SECRET;

const blockers = [];
const warnings = [];

if (!cronSecret) {
  blockers.push("CRON_SECRET o WORKER_SECRET requerido.");
}

if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
  blockers.push("limit debe ser entero entre 1 y 100.");
}

if (!isHttpsUrl(baseUrl) && process.env.APP_ENV !== "local") {
  blockers.push("base-url debe ser https fuera de local.");
}

if (!run) {
  warnings.push(
    "Modo readiness: no se ejecuto el worker. Usa -- --run para disparar el scheduler."
  );
}

const endpoint = `${baseUrl}/api/internal/workers/outbox?limit=${limit}&include_snapshot=${includeSnapshot}`;

if (blockers.length > 0) {
  console.log(
    JSON.stringify(
      {
        ok: false,
        mode: run ? "run" : "readiness",
        endpoint,
        blockers,
        warnings,
      },
      null,
      2
    )
  );
  process.exitCode = 1;
} else if (!run) {
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "readiness",
        endpoint,
        authorization_header_configured: true,
        would_call_worker: true,
        warnings,
      },
      null,
      2
    )
  );
} else {
  const response = await fetch(endpoint, {
    method: "GET",
    headers: {
      authorization: `Bearer ${cronSecret}`,
    },
  });
  const text = await response.text();
  const payload = parseJson(text);

  if (!response.ok || payload?.ok !== true) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          mode: "run",
          status: response.status,
          endpoint,
          response: payload ?? text.slice(0, 1000),
        },
        null,
        2
      )
    );
    process.exitCode = 1;
  } else {
    const data = payload.data ?? {};
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "run",
          status: response.status,
          endpoint,
          worker: data.worker,
          trigger: data.trigger,
          job_run_id: data.job_run_id,
          result: data.result,
          snapshot: data.snapshot,
        },
        null,
        2
      )
    );
  }
}

function parseArgs(values) {
  const parsed = {};

  for (const value of values) {
    if (value === "--run") {
      parsed.run = "true";
      continue;
    }

    const match = value.match(/^--([^=]+)=(.*)$/);
    if (match) {
      parsed[match[1]] = match[2];
    }
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

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
