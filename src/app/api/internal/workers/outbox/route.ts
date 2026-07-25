import { z } from "zod";
import { createServiceClient } from "@/data/supabase/server";
import {
  finishWorkerJobRun,
  getOutboxOperationalSnapshot,
  startWorkerJobRun,
  type WorkerJobRun,
} from "@/data/repositories/worker-operations.repository";
import { publishOutboxBatch } from "@/workers/outbox/outbox-publisher";
import { createDefaultOutboxHandlers } from "@/workers/outbox/default-handlers";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

const OutboxWorkerRequestSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).optional(),
    include_snapshot: z
      .union([
        z.boolean(),
        z.enum(["true", "false"]).transform((value) => value === "true"),
      ])
      .optional(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await readJsonBody(request);
  return handleOutboxWorker(request, body);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return handleOutboxWorker(
    request,
    Object.fromEntries(url.searchParams.entries())
  );
}

async function handleOutboxWorker(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  let jobRun: WorkerJobRun | null = null;

  try {
    const authError = authorizeOutboxWorker(request, meta);
    if (authError) return authError;

    const parsed = OutboxWorkerRequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const trigger = request.method === "GET" ? "cron_get" : "worker_post";
    jobRun = await startWorkerJobRun(serviceClient, {
      job_name: "outbox_publisher",
      trigger,
      trace_id,
      metadata: {
        limit: parsed.limit ?? 25,
        include_snapshot: parsed.include_snapshot ?? true,
      },
    });
    const result = await publishOutboxBatch(serviceClient, {
      limit: parsed.limit,
      handlers: createDefaultOutboxHandlers(serviceClient),
    });
    const snapshot =
      parsed.include_snapshot === false
        ? null
        : await getOutboxOperationalSnapshot(serviceClient);
    const status = result.failed > 0 ? "partial" : "succeeded";
    const finishedRun = await finishWorkerJobRun(serviceClient, {
      run: jobRun,
      status,
      result: {
        ...result,
        snapshot,
      },
      claimed_count: result.claimed,
      processed_count: result.published,
      failed_count: result.failed,
      skipped_count: result.skipped,
    });

    return okJson(
      {
        worker: "outbox_publisher",
        trigger,
        job_run_id: finishedRun.id,
        result,
        snapshot,
      },
      meta
    );
  } catch (error) {
    if (jobRun) {
      await finishFailedJobRun(jobRun, error);
    }
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function authorizeOutboxWorker(request: Request, meta: { trace_id: string }) {
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

async function finishFailedJobRun(jobRun: WorkerJobRun, error: unknown) {
  const serviceClient = createServiceClient();
  try {
    await finishWorkerJobRun(serviceClient, {
      run: jobRun,
      status: "failed",
      last_error: error instanceof Error ? error.message : "unknown_error",
      result: {},
    });
  } catch {
    // La respuesta principal debe conservar el error original del worker.
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
