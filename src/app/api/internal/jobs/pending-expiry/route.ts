import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { expireOverduePendingItems } from "@/data/repositories/pending.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const PendingExpiryWorkerRequestSchema = z
  .object({
    as_of: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

/** RUL-PEND-08 (27 S6/S17): caduca a los 60 dias, ejecutado por cron. */
export async function POST(request: Request) {
  const url = new URL(request.url);
  return handlePendingExpiry(
    request,
    Object.fromEntries(url.searchParams.entries())
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handlePendingExpiry(
    request,
    Object.fromEntries(url.searchParams.entries())
  );
}

async function handlePendingExpiry(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const authError = authorizePendingExpiry(request, meta);
    if (authError) return authError;

    const parsed = PendingExpiryWorkerRequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const result = await expireOverduePendingItems(serviceClient, parsed.as_of);

    return okJson(
      {
        worker: "pending_expiry",
        trigger: request.method === "GET" ? "cron_get" : "worker_post",
        ...result,
      },
      meta
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function authorizePendingExpiry(
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
