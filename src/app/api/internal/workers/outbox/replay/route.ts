import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";
import {
  finishWorkerJobRun,
  requeueOutboxEvent,
  startWorkerJobRun,
  type WorkerJobRun,
} from "@/data/repositories/worker-operations.repository";

export const dynamic = "force-dynamic";

const ReplayOutboxRequestSchema = z
  .object({
    outbox_id: z.string().uuid(),
    reason: z.string().trim().min(8).max(500),
    requested_by: z.string().trim().min(3).max(80).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  let jobRun: WorkerJobRun | null = null;

  try {
    const authError = authorizeReplay(request, meta);
    if (authError) return authError;

    const parsed = ReplayOutboxRequestSchema.parse(await readJsonBody(request));
    const serviceClient = createServiceClient();
    jobRun = await startWorkerJobRun(serviceClient, {
      job_name: "outbox_replay",
      trigger: "manual_replay",
      trace_id,
      metadata: {
        outbox_id: parsed.outbox_id,
        reason: parsed.reason,
        requested_by: parsed.requested_by ?? "operator",
      },
    });
    const event = await requeueOutboxEvent(serviceClient, {
      outbox_id: parsed.outbox_id,
      reason: parsed.reason,
      trace_id,
      requested_by: parsed.requested_by,
    });
    const finishedRun = await finishWorkerJobRun(serviceClient, {
      run: jobRun,
      status: "succeeded",
      result: {
        outbox_id: event.id,
        event_type: event.event_type,
        status: event.status,
      },
      processed_count: 1,
    });

    return okJson(
      {
        worker: "outbox_replay",
        job_run_id: finishedRun.id,
        event,
      },
      meta
    );
  } catch (error) {
    if (jobRun) await finishFailedJobRun(jobRun, error);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function authorizeReplay(request: Request, meta: { trace_id: string }) {
  const authorization = request.headers.get("authorization");
  const expectedSecret = process.env.WORKER_SECRET;

  if (expectedSecret) {
    if (authorization !== `Bearer ${expectedSecret}`) {
      return errorJson("FORBIDDEN", "Replay no autorizado.", meta, 403);
    }
    return null;
  }

  if (process.env.APP_ENV !== "local") {
    return errorJson(
      "FORBIDDEN",
      "WORKER_SECRET no configurado para replay.",
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
    // La respuesta principal debe conservar el error original del replay.
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
