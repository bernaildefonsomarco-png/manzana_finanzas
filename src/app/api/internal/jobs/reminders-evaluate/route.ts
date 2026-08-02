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
import { evaluateRemindersForUser } from "@/data/repositories/reminders-evaluate.repository";
import { finishWorkerJobRun, startWorkerJobRun } from "@/data/repositories/worker-operations.repository";
import { createServiceClient } from "@/data/supabase/server";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

export const dynamic = "force-dynamic";

type Client = SupabaseClient<Database>;

const RequestSchema = z
  .object({
    user_id: z.string().uuid().optional(),
    max_users: z.coerce.number().int().min(1).max(500).optional(),
  })
  .strict();

// 37 §17: evaluación diaria, no continua. Genera los recordatorios de
// escaneo (pago_proximo/vencido, cuota_proxima/vencida, pendientes_acumulados,
// sin_registrar, correo_desconectado). `descarga_lista`/`confirmar_hecho` no
// pasan por aquí: nacen de triggers sobre su propia tabla (migración 063).
export async function POST(request: Request) {
  return handle(request, await readJsonBody(request));
}
export async function GET(request: Request) {
  return handle(request, Object.fromEntries(new URL(request.url).searchParams.entries()));
}

async function handle(request: Request, input: unknown) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const authError = authorize(request, meta);
    if (authError) return authError;

    const parsed = RequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const run = await startWorkerJobRun(serviceClient, {
      job_name: "reminders_evaluate",
      trigger: request.method === "GET" ? "cron_get" : "worker_post",
      trace_id,
      metadata: { requested_user_id: parsed.user_id ?? null, max_users: parsed.max_users ?? 200 },
    });

    try {
      const userIds = parsed.user_id
        ? [parsed.user_id]
        : await listActiveUserIds(serviceClient, parsed.max_users ?? 200);

      let created = 0;
      let skipped = 0;
      for (const userId of userIds) {
        const result = await evaluateRemindersForUser(serviceClient, userId);
        created += result.created;
        skipped += result.skipped;
      }

      await finishWorkerJobRun(serviceClient, {
        run,
        status: "succeeded",
        claimed_count: userIds.length,
        processed_count: userIds.length,
        result: { users: userIds.length, created, skipped },
      });

      return okJson({ worker: "reminders_evaluate", users: userIds.length, created, skipped }, meta);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      await finishWorkerJobRun(serviceClient, {
        run,
        status: "failed",
        failed_count: 1,
        last_error: message,
        result: { alert: "reminders_evaluate_failed" },
      });
      logger.error("reminders_evaluate.failed", { trace_id, error: message });
      throw error;
    }
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

async function listActiveUserIds(client: Client, maxUsers: number): Promise<string[]> {
  const { data, error } = await client
    .from("movements")
    .select("user_id,created_at")
    .order("created_at", { ascending: false })
    .limit(maxUsers * 10);
  if (error) throw error;

  const seen = new Set<string>();
  const result: string[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.user_id)) continue;
    seen.add(row.user_id);
    result.push(row.user_id);
    if (result.length >= maxUsers) break;
  }
  return result;
}

function authorize(request: Request, meta: { trace_id: string }) {
  const authorization = request.headers.get("authorization");
  const allowedSecrets = [process.env.CRON_SECRET, process.env.WORKER_SECRET].filter(
    (secret): secret is string => Boolean(secret),
  );
  if (allowedSecrets.length > 0) {
    const authorized = allowedSecrets.some((secret) => authorization === `Bearer ${secret}`);
    if (!authorized) return errorJson("FORBIDDEN", "Worker no autorizado.", meta, 403);
    return null;
  }
  if (process.env.APP_ENV !== "local") {
    return errorJson("FORBIDDEN", "CRON_SECRET o WORKER_SECRET no configurado.", meta, 403);
  }
  return null;
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
