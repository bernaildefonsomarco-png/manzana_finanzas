import { NextResponse } from "next/server";
import { logger } from "@/shared/telemetry/logger";

export const dynamic = "force-dynamic";

type HealthStatus = "ok" | "degraded" | "error";

type CheckResult = {
  status: HealthStatus;
  latency_ms?: number;
  message?: string;
};

type HealthResponse = {
  status: HealthStatus;
  version: string;
  env: string;
  timestamp: string;
  checks: {
    supabase: CheckResult;
  };
};

async function checkSupabase(): Promise<CheckResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key || url.includes("your-project")) {
    return { status: "degraded", message: "Supabase no configurado" };
  }

  const start = Date.now();
  try {
    const res = await fetch(
      `${url}/rest/v1/external_event_log?select=id&limit=1`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        signal: AbortSignal.timeout(3000),
      }
    );
    const latency_ms = Date.now() - start;

    if (res.ok) {
      return { status: "ok", latency_ms };
    }
    return { status: "degraded", latency_ms, message: `HTTP ${res.status}` };
  } catch (err) {
    return {
      status: "error",
      latency_ms: Date.now() - start,
      message: err instanceof Error ? err.message : "Error desconocido",
    };
  }
}

export async function GET() {
  const supabase = await checkSupabase();

  const overallStatus: HealthStatus =
    supabase.status === "error"
      ? "error"
      : supabase.status === "degraded"
      ? "degraded"
      : "ok";

  const body: HealthResponse = {
    status: overallStatus,
    version: process.env.npm_package_version ?? "0.1.0",
    env: process.env.APP_ENV ?? "local",
    timestamp: new Date().toISOString(),
    checks: { supabase },
  };

  const httpStatus = overallStatus === "error" ? 503 : 200;

  logger.info("health_check", { status: overallStatus });

  return NextResponse.json(body, { status: httpStatus });
}
