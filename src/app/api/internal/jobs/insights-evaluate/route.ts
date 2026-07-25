import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { evaluateAdvancedInsights } from "@/data/repositories/insights.repository";
import { createServiceClient } from "@/data/supabase/server";
import type { Database } from "@/data/supabase/types";

export const dynamic = "force-dynamic";

type Client = SupabaseClient<Database>;

const InsightsEvaluateWorkerRequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    max_users: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return handleInsightsEvaluate(request, body);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleInsightsEvaluate(request, Object.fromEntries(url.searchParams.entries()));
}

async function handleInsightsEvaluate(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const authError = authorizeInsightsEvaluate(request, meta);
    if (authError) return authError;

    const parsed = InsightsEvaluateWorkerRequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const userIds = parsed.user_id
      ? [parsed.user_id]
      : await listInsightEligibleUserIds(serviceClient, parsed.max_users ?? 50);
    const results = [];

    for (const userId of userIds) {
      const result = await evaluateAdvancedInsights(serviceClient, userId, {
        traceId: trace_id,
      });
      results.push({ user_id: userId, result });
    }

    return okJson(
      {
        worker: "insights_evaluate",
        trigger: request.method === "GET" ? "cron_get" : "worker_post",
        users: results.length,
        results,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function authorizeInsightsEvaluate(
  request: Request,
  meta: { trace_id: string },
) {
  const authorization = request.headers.get("authorization");
  const allowedSecrets = [process.env.CRON_SECRET, process.env.WORKER_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );

  if (allowedSecrets.length > 0) {
    const authorized = allowedSecrets.some(
      (secret) => authorization === `Bearer ${secret}`,
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
      403,
    );
  }

  return null;
}

async function listInsightEligibleUserIds(
  client: Client,
  maxUsers: number,
): Promise<string[]> {
  const sourceLimit = Math.min(maxUsers * 12, 2_400);
  const [movements, debts, recurringRules, recurringCandidates, accounts] =
    await Promise.all([
      client
        .from("movements")
        .select("user_id,updated_at")
        .eq("status", "confirmed")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(sourceLimit),
      client
        .from("debts")
        .select("user_id,updated_at")
        .is("deleted_at", null)
        .in("status", ["active", "due_soon", "overdue"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit),
      client
        .from("recurring_rules")
        .select("user_id,updated_at")
        .is("deleted_at", null)
        .in("status", ["active", "suggested", "paused"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit),
      client
        .from("recurring_candidates")
        .select("user_id,updated_at")
        .in("status", ["ready_to_suggest", "suggested"])
        .order("updated_at", { ascending: false })
        .limit(sourceLimit),
      client
        .from("accounts")
        .select("user_id,updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(sourceLimit),
    ]);

  const results = [movements, debts, recurringRules, recurringCandidates, accounts];
  for (const result of results) {
    if (result.error) throw result.error;
  }
  return selectInsightEligibleUserIds(
    results.flatMap((result) => result.data ?? []),
    maxUsers,
  );
}

export function selectInsightEligibleUserIds(
  activities: Array<{ user_id: string; updated_at: string }>,
  maxUsers: number,
): string[] {
  const seen = new Set<string>();
  return [...activities]
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at))
    .flatMap((activity) => {
      if (seen.has(activity.user_id)) return [];
      seen.add(activity.user_id);
      return [activity.user_id];
    })
    .slice(0, maxUsers);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
