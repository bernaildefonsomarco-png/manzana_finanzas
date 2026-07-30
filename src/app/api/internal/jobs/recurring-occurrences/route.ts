import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  listRecurringOccurrenceGenerationUserIds,
  materializeRecurringOccurrenceHorizon,
} from "@/data/repositories/recurring.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const RecurringOccurrencesWorkerRequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    as_of_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fecha YYYY-MM-DD")
      .optional(),
    horizon_days: z.coerce.number().int().min(1).max(90).optional(),
    max_users: z.coerce.number().int().min(1).max(200).optional(),
  })
  .strict();

export async function POST(request: Request) {
  return handleRecurringOccurrences(request, await readJsonBody(request));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleRecurringOccurrences(
    request,
    Object.fromEntries(url.searchParams.entries())
  );
}

async function handleRecurringOccurrences(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const authError = authorizeWorker(request, meta);
    if (authError) return authError;

    const parsed = RecurringOccurrencesWorkerRequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const userIds = parsed.user_id
      ? [parsed.user_id]
      : await listRecurringOccurrenceGenerationUserIds(
          serviceClient,
          parsed.max_users
        );
    const results = [];

    for (const userId of userIds) {
      results.push({
        user_id: userId,
        result: await materializeRecurringOccurrenceHorizon(
          serviceClient,
          userId,
          {
            asOfDate: parsed.as_of_date,
            horizonDays: parsed.horizon_days,
          }
        ),
      });
    }

    return okJson(
      {
        worker: "recurring_occurrences",
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

function authorizeWorker(request: Request, meta: { trace_id: string }) {
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
