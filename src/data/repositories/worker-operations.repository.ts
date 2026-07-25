import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { toJson, type OutboxEvent } from "@/core/events/domain-events";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type WorkerJobRunStatus = "running" | "succeeded" | "partial" | "failed";

export type WorkerJobRun = {
  id: string;
  job_name: string;
  trigger: string;
  status: WorkerJobRunStatus;
  trace_id: string;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  claimed_count: number;
  processed_count: number;
  failed_count: number;
  skipped_count: number;
  metadata: Record<string, unknown>;
  result: Record<string, unknown>;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type OutboxOperationalSnapshot = {
  checked_at: string;
  scanned: number;
  counts: {
    pending: number;
    processing: number;
    failed: number;
    dead_letter: number;
  };
  oldest_pending_created_at: string | null;
  oldest_pending_lag_seconds: number | null;
  oldest_processing_started_at: string | null;
  oldest_processing_lag_seconds: number | null;
  failed_event_types: Array<{
    event_type: string;
    count: number;
  }>;
};

export class WorkerOperationsRepositoryError extends Error {
  constructor(
    readonly code:
      | "WORKER_JOB_RUN_ERROR"
      | "OUTBOX_SNAPSHOT_ERROR"
      | "OUTBOX_REQUEUE_ERROR",
    message: string
  ) {
    super(message);
    this.name = "WorkerOperationsRepositoryError";
  }
}

export async function startWorkerJobRun(
  client: Client,
  input: {
    job_name: string;
    trigger: string;
    trace_id: string;
    metadata?: Record<string, unknown>;
  }
): Promise<WorkerJobRun> {
  const { data, error } = await client
    .from("worker_job_runs")
    .insert({
      job_name: input.job_name,
      trigger: input.trigger,
      trace_id: input.trace_id,
      metadata: toJson(input.metadata ?? {}),
    })
    .select("*")
    .single();

  if (error || !data) {
    logger.error("worker_operations.start_job_run_failed", {
      error,
      job_name: input.job_name,
      trigger: input.trigger,
    });
    throw new WorkerOperationsRepositoryError(
      "WORKER_JOB_RUN_ERROR",
      "No se pudo iniciar el registro operativo del worker"
    );
  }

  return data as WorkerJobRun;
}

export async function finishWorkerJobRun(
  client: Client,
  input: {
    run: WorkerJobRun;
    status: Exclude<WorkerJobRunStatus, "running">;
    result?: Record<string, unknown>;
    last_error?: string | null;
    claimed_count?: number;
    processed_count?: number;
    failed_count?: number;
    skipped_count?: number;
  }
): Promise<WorkerJobRun> {
  const finishedAt = new Date();
  const durationMs = Math.max(
    0,
    finishedAt.getTime() - new Date(input.run.started_at).getTime()
  );
  const { data, error } = await client
    .from("worker_job_runs")
    .update({
      status: input.status,
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      claimed_count: input.claimed_count ?? input.run.claimed_count,
      processed_count: input.processed_count ?? input.run.processed_count,
      failed_count: input.failed_count ?? input.run.failed_count,
      skipped_count: input.skipped_count ?? input.run.skipped_count,
      result: toJson(input.result ?? {}),
      last_error: input.last_error ?? null,
    })
    .eq("id", input.run.id)
    .select("*")
    .single();

  if (error || !data) {
    logger.error("worker_operations.finish_job_run_failed", {
      error,
      job_run_id: input.run.id,
      status: input.status,
    });
    throw new WorkerOperationsRepositoryError(
      "WORKER_JOB_RUN_ERROR",
      "No se pudo cerrar el registro operativo del worker"
    );
  }

  return data as WorkerJobRun;
}

export async function getOutboxOperationalSnapshot(
  client: Client,
  options: { limit?: number } = {}
): Promise<OutboxOperationalSnapshot> {
  const limit = options.limit ?? 1000;
  const { data, error } = await client
    .from("transactional_outbox")
    .select(
      "id,status,created_at,processing_started_at,event_type,last_error"
    )
    .in("status", ["pending", "processing", "failed", "dead_letter"])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    logger.error("worker_operations.outbox_snapshot_failed", { error, limit });
    throw new WorkerOperationsRepositoryError(
      "OUTBOX_SNAPSHOT_ERROR",
      "No se pudo calcular el snapshot operativo del outbox"
    );
  }

  return buildOutboxOperationalSnapshot(
    (data ?? []) as Array<{
      id: string;
      status: string;
      created_at: string;
      processing_started_at: string | null;
      event_type: string;
      last_error: string | null;
    }>
  );
}

export async function requeueOutboxEvent(
  client: Client,
  input: {
    outbox_id: string;
    reason: string;
    trace_id: string;
    requested_by?: string;
  }
): Promise<OutboxEvent> {
  const { data, error } = await client.rpc("requeue_outbox_event", {
    p_outbox_id: input.outbox_id,
    p_reason: input.reason,
    p_trace_id: input.trace_id,
    p_requested_by: input.requested_by ?? "operator",
  });

  if (error || !data) {
    logger.error("worker_operations.requeue_outbox_failed", {
      error,
      outbox_id: input.outbox_id,
    });
    throw new WorkerOperationsRepositoryError(
      "OUTBOX_REQUEUE_ERROR",
      "No se pudo reencolar el evento outbox"
    );
  }

  return data as OutboxEvent;
}

export function buildOutboxOperationalSnapshot(
  events: Array<{
    status: string;
    created_at: string;
    processing_started_at: string | null;
    event_type: string;
  }>
): OutboxOperationalSnapshot {
  const checkedAt = new Date();
  const counts = {
    pending: 0,
    processing: 0,
    failed: 0,
    dead_letter: 0,
  };
  let oldestPendingCreatedAt: string | null = null;
  let oldestProcessingStartedAt: string | null = null;
  const failedEventTypeCounts = new Map<string, number>();

  for (const event of events) {
    if (event.status in counts) {
      counts[event.status as keyof typeof counts] += 1;
    }

    if (event.status === "pending") {
      oldestPendingCreatedAt = minIso(oldestPendingCreatedAt, event.created_at);
    }

    if (event.status === "processing" && event.processing_started_at) {
      oldestProcessingStartedAt = minIso(
        oldestProcessingStartedAt,
        event.processing_started_at
      );
    }

    if (event.status === "failed" || event.status === "dead_letter") {
      failedEventTypeCounts.set(
        event.event_type,
        (failedEventTypeCounts.get(event.event_type) ?? 0) + 1
      );
    }
  }

  return {
    checked_at: checkedAt.toISOString(),
    scanned: events.length,
    counts,
    oldest_pending_created_at: oldestPendingCreatedAt,
    oldest_pending_lag_seconds: secondsBetween(
      oldestPendingCreatedAt,
      checkedAt
    ),
    oldest_processing_started_at: oldestProcessingStartedAt,
    oldest_processing_lag_seconds: secondsBetween(
      oldestProcessingStartedAt,
      checkedAt
    ),
    failed_event_types: [...failedEventTypeCounts.entries()]
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((left, right) => right.count - left.count),
  };
}

function minIso(current: string | null, candidate: string): string {
  if (!current) return candidate;
  return candidate < current ? candidate : current;
}

function secondsBetween(from: string | null, to: Date): number | null {
  if (!from) return null;
  return Math.max(0, Math.floor((to.getTime() - new Date(from).getTime()) / 1000));
}
