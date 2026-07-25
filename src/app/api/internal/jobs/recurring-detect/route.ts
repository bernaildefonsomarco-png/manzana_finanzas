import { z } from "zod";
import { createServiceClient } from "@/data/supabase/server";
import { runRecurringCandidateDetection } from "@/data/repositories/recurring.repository";
import type { Database } from "@/data/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

type Client = SupabaseClient<Database>;

const RecurringDetectWorkerRequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    lookback_days: z.coerce.number().int().min(30).max(730).optional(),
    limit: z.coerce.number().int().min(20).max(1000).optional(),
    max_users: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return handleRecurringDetect(request, body);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleRecurringDetect(request, Object.fromEntries(url.searchParams.entries()));
}

async function handleRecurringDetect(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const authError = authorizeRecurringDetect(request, meta);
    if (authError) return authError;

    const parsed = RecurringDetectWorkerRequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const userIds = parsed.user_id
      ? [parsed.user_id]
      : await listRecentMovementUserIds(serviceClient, {
          lookbackDays: parsed.lookback_days ?? 180,
          maxUsers: parsed.max_users ?? 50,
        });
    const results = [];

    for (const userId of userIds) {
      const result = await runRecurringCandidateDetection(serviceClient, userId, {
        lookbackDays: parsed.lookback_days,
        limit: parsed.limit,
        traceId: trace_id,
      });
      results.push({ user_id: userId, result });
    }

    return okJson(
      {
        worker: "recurring_detect",
        trigger: request.method === "GET" ? "cron_get" : "worker_post",
        users: results.length,
        results,
      },
      meta
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function authorizeRecurringDetect(
  request: Request,
  meta: { trace_id: string }
) {
  const authorization = request.headers.get("authorization");
  const allowedSecrets = [
    process.env.CRON_SECRET,
    process.env.WORKER_SECRET,
  ].filter((secret): secret is string => Boolean(secret));

  if (allowedSecrets.length > 0) {
    const authorized = allowedSecrets.some(
      (secret) => authorization === `Bearer ${secret}`
    );
    if (!authorized) {
      return errorJson("FORBIDDEN", "Worker no autorizado.", meta, 403);
    }
    return null;
  }

  if (process.env.APP_ENV !== "local") {
    return errorJson(
      "FORBIDDEN",
      "CRON_SECRET o WORKER_SECRET no configurado para ejecutar workers.",
      meta,
      403
    );
  }

  return null;
}

async function listRecentMovementUserIds(
  client: Client,
  options: { lookbackDays: number; maxUsers: number }
): Promise<string[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - options.lookbackDays);
  const scanLimit = Math.min(options.maxUsers * 100, 5000);
  const { data, error } = await client
    .from("movements")
    .select("user_id")
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .gte("occurred_at", since.toISOString())
    .order("occurred_at", { ascending: false })
    .limit(scanLimit);

  if (error) throw error;

  return [...new Set((data ?? []).map((row) => row.user_id))].slice(
    0,
    options.maxUsers
  );
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
