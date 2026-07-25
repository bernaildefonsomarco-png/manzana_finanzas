import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { refreshDebtLifecycle } from "@/core/debts/debt-lifecycle-service";
import { listDebtLifecycleUserIds } from "@/data/repositories/debts.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const DebtLifecycleWorkerRequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    as_of_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fecha YYYY-MM-DD")
      .optional(),
    due_soon_days: z.coerce.number().int().min(1).max(14).optional(),
    max_users: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return handleDebtLifecycle(request, body);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleDebtLifecycle(
    request,
    Object.fromEntries(url.searchParams.entries())
  );
}

async function handleDebtLifecycle(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const authError = authorizeDebtLifecycle(request, meta);
    if (authError) return authError;

    const parsed = DebtLifecycleWorkerRequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const userIds = parsed.user_id
      ? [parsed.user_id]
      : await listDebtLifecycleUserIds(
          serviceClient,
          parsed.max_users ?? 50
        );
    const results = [];

    for (const userId of userIds) {
      const result = await refreshDebtLifecycle(serviceClient, userId, {
        asOfDate: parsed.as_of_date,
        dueSoonDays: parsed.due_soon_days,
        traceId: trace_id,
      });
      results.push({ user_id: userId, result });
    }

    return okJson(
      {
        worker: "debt_lifecycle",
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

function authorizeDebtLifecycle(
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

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
