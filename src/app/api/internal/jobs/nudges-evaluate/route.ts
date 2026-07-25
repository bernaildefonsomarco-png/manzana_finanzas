import { z } from "zod";
import { createServiceClient } from "@/data/supabase/server";
import { evaluateDashboardNudges } from "@/data/repositories/nudges.repository";
import { deliverProactiveNudgesForUser } from "@/workers/nudges/proactive-nudge-worker";
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

const NudgesEvaluateWorkerRequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    horizon_days: z.coerce.number().int().min(1).max(14).optional(),
    max_users: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return handleNudgesEvaluate(request, body);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleNudgesEvaluate(request, Object.fromEntries(url.searchParams.entries()));
}

async function handleNudgesEvaluate(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const authError = authorizeNudgesEvaluate(request, meta);
    if (authError) return authError;

    const parsed = NudgesEvaluateWorkerRequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const userIds = parsed.user_id
      ? [parsed.user_id]
      : await listNudgeEligibleUserIds(serviceClient, parsed.max_users ?? 50);
    const results = [];

    for (const userId of userIds) {
      const dashboard = await evaluateDashboardNudges(serviceClient, userId, {
        horizonDays: parsed.horizon_days,
        traceId: trace_id,
      });
      const proactive = await deliverProactiveNudgesForUser(
        serviceClient,
        userId,
        { traceId: trace_id },
      );
      results.push({ user_id: userId, dashboard, proactive });
    }

    return okJson(
      {
        worker: "nudges_evaluate",
        trigger: request.method === "GET" ? "cron_get" : "worker_post",
        channels: ["dashboard", "whatsapp"],
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

function authorizeNudgesEvaluate(
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

async function listNudgeEligibleUserIds(
  client: Client,
  maxUsers: number
): Promise<string[]> {
  const scanLimit = Math.min(maxUsers * 20, 5000);
  const [
    recurringResult,
    debtResult,
    proactiveResult,
    movementResult,
    pendingResult,
    windowResult,
  ] = await Promise.all([
    client
      .from("recurring_rules")
      .select("user_id")
      .eq("status", "active")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(scanLimit),
    client
      .from("debt_installments")
      .select("user_id")
      .in("status", ["pending", "due_soon", "overdue"])
      .order("updated_at", { ascending: false })
      .limit(scanLimit),
    client
      .from("nudge_candidates")
      .select("user_id")
      .in("status", ["candidate", "approved", "deferred", "scheduled"])
      .order("updated_at", { ascending: false })
      .limit(scanLimit),
    client
      .from("movements")
      .select("user_id")
      .in("status", ["confirmed", "corrected"])
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(scanLimit),
    client
      .from("pending_items")
      .select("user_id")
      .in("status", ["pending", "sent_for_confirmation", "user_edited"])
      .order("updated_at", { ascending: false })
      .limit(scanLimit),
    client
      .from("whatsapp_window_states")
      .select("user_id")
      .not("last_user_message_at", "is", null)
      .order("last_user_message_at", { ascending: false })
      .limit(scanLimit),
  ]);

  for (const result of [
    recurringResult,
    debtResult,
    proactiveResult,
    movementResult,
    pendingResult,
    windowResult,
  ]) {
    if (result.error) throw result.error;
  }

  return selectNudgeEligibleUserIds(
    (recurringResult.data ?? []).map((row) => row.user_id),
    (debtResult.data ?? []).map((row) => row.user_id),
    maxUsers,
    (proactiveResult.data ?? []).map((row) => row.user_id),
    (movementResult.data ?? []).map((row) => row.user_id),
    (pendingResult.data ?? []).map((row) => row.user_id),
    (windowResult.data ?? []).map((row) => row.user_id),
  );
}

export function selectNudgeEligibleUserIds(
  recurringUserIds: string[],
  debtUserIds: string[],
  maxUsers: number,
  proactiveUserIds: string[] = [],
  movementUserIds: string[] = [],
  pendingUserIds: string[] = [],
  windowUserIds: string[] = [],
): string[] {
  return [
    ...new Set([
      ...recurringUserIds,
      ...debtUserIds,
      ...proactiveUserIds,
      ...movementUserIds,
      ...pendingUserIds,
      ...windowUserIds,
    ]),
  ].slice(0, maxUsers);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
