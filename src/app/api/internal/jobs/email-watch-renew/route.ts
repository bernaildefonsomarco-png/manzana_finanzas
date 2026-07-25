import { z } from "zod";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { renewDueGmailWatches } from "@/core/email/email-connection";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).optional(),
}).strict();

export async function POST(request: Request) {
  return handle(request, await readJsonBody(request));
}

export async function GET(request: Request) {
  return handle(request, Object.fromEntries(new URL(request.url).searchParams.entries()));
}

async function handle(request: Request, body: unknown) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const authorization = request.headers.get("authorization");
    const secrets = [process.env.CRON_SECRET, process.env.WORKER_SECRET].filter(
      (value): value is string => Boolean(value),
    );
    if (
      (secrets.length > 0 && !secrets.some((secret) => authorization === `Bearer ${secret}`)) ||
      (secrets.length === 0 && process.env.APP_ENV !== "local")
    ) {
      return errorJson("FORBIDDEN", "Worker no autorizado.", meta, 403);
    }
    const parsed = RequestSchema.parse(body);
    const result = await renewDueGmailWatches({
      client: createServiceClient(),
      limit: parsed.limit,
    });
    return okJson({ worker: "email_watch_renew", ...result }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
