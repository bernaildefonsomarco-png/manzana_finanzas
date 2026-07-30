import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { runBudgetDailyLifecycle } from "@/data/repositories/budgets.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const RequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    as_of: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Usa fecha YYYY-MM-DD")
      .optional(),
  })
  .strict();

export async function GET(request: Request) {
  return handle(
    request,
    Object.fromEntries(new URL(request.url).searchParams.entries())
  );
}

export async function POST(request: Request) {
  return handle(request, await readJsonBody(request));
}

async function handle(request: Request, input: unknown) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const authError = authorizeWorker(request, meta);
    if (authError) return authError;
    const parsed = RequestSchema.parse(input);
    const result = await runBudgetDailyLifecycle(createServiceClient(), {
      asOf: parsed.as_of,
      userId: parsed.user_id,
    });
    return okJson(
      {
        worker: "budgets_daily",
        trigger: request.method === "GET" ? "cron_get" : "worker_post",
        result,
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
  const secrets = [process.env.CRON_SECRET, process.env.WORKER_SECRET].filter(
    (value): value is string => Boolean(value)
  );
  if (secrets.length > 0) {
    if (!secrets.some((secret) => authorization === `Bearer ${secret}`)) {
      return errorJson("FORBIDDEN", "Worker no autorizado.", meta, 403);
    }
    return null;
  }
  return process.env.APP_ENV === "local"
    ? null
    : errorJson(
        "FORBIDDEN",
        "CRON_SECRET o WORKER_SECRET no configurado para ejecutar workers.",
        meta,
        403
      );
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
