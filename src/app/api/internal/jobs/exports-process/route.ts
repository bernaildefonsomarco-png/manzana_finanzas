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
import { finishWorkerJobRun, startWorkerJobRun } from "@/data/repositories/worker-operations.repository";
import { createServiceClient } from "@/data/supabase/server";
import type { Database } from "@/data/supabase/types";
import { buildMovementsCsv, exportFileName, type CsvMovementRow } from "@/core/reports/csv-export";
import { logger } from "@/shared/telemetry/logger";

export const dynamic = "force-dynamic";

type Client = SupabaseClient<Database>;

const RequestSchema = z.object({ max_jobs: z.coerce.number().int().min(1).max(50).optional() }).strict();

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

    const { max_jobs } = RequestSchema.parse(input);
    const serviceClient = createServiceClient();
    const run = await startWorkerJobRun(serviceClient, {
      job_name: "exports_process",
      trigger: request.method === "GET" ? "cron_get" : "worker_post",
      trace_id,
      metadata: { max_jobs: max_jobs ?? 10 },
    });

    try {
      const { data: pending, error } = await serviceClient
        .from("export_jobs")
        .select("id,user_id,kind,format")
        .eq("status", "pendiente")
        .order("requested_at", { ascending: true })
        .limit(max_jobs ?? 10);
      if (error) throw error;

      let processed = 0;
      let failed = 0;
      for (const job of pending ?? []) {
        try {
          await processExportJob(serviceClient, job as { id: string; user_id: string; kind: string; format: string });
          processed += 1;
        } catch (jobError) {
          failed += 1;
          const message = jobError instanceof Error ? jobError.message : "unknown_error";
          await serviceClient
            .from("export_jobs")
            .update({ status: "fallido", failure_reason: message })
            .eq("id", job.id);
          logger.error("exports_process.job_failed", { trace_id, job_id: job.id, error: message });
        }
      }

      await finishWorkerJobRun(serviceClient, {
        run,
        status: failed > 0 && processed === 0 ? "failed" : failed > 0 ? "partial" : "succeeded",
        claimed_count: pending?.length ?? 0,
        processed_count: processed,
        failed_count: failed,
        result: { processed, failed },
      });

      return okJson({ worker: "exports_process", processed, failed }, meta);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      await finishWorkerJobRun(serviceClient, {
        run,
        status: "failed",
        failed_count: 1,
        last_error: message,
        result: { alert: "exports_process_failed" },
      });
      throw error;
    }
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

async function processExportJob(
  client: Client,
  job: { id: string; user_id: string; kind: string; format: string },
): Promise<void> {
  await client.from("export_jobs").update({ status: "procesando" }).eq("id", job.id);

  const content =
    job.kind === "datos_completos"
      ? await buildFullExportJson(client, job.user_id)
      : await buildMovementsCsvContent(client, job.user_id);

  const path = `${job.user_id}/${job.id}-${exportFileName(job.kind as "movimientos" | "datos_completos")}`;
  const { error: uploadError } = await client.storage.from("exports").upload(path, content, {
    contentType: job.kind === "datos_completos" ? "application/json" : "text/csv",
    upsert: true,
  });
  if (uploadError) throw uploadError;

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rowCount = job.kind === "datos_completos" ? null : content.split("\r\n").length - 2;

  await client
    .from("export_jobs")
    .update({
      status: "listo",
      storage_path: path,
      row_count: rowCount && rowCount > 0 ? rowCount : 0,
      completed_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .eq("id", job.id);
}

async function buildMovementsCsvContent(client: Client, userId: string): Promise<string> {
  const { data, error } = await client
    .from("movements")
    .select(
      "id,type,status,amount,currency,occurred_at,description,category_id,subcategory_id,account_origin_id,source",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("occurred_at", { ascending: false })
    .limit(50_000);
  if (error) throw error;

  type Row = {
    id: string;
    type: string;
    status: string;
    amount: number;
    currency: string;
    occurred_at: string;
    description: string | null;
    category_id: string | null;
    subcategory_id: string | null;
    account_origin_id: string | null;
    source: string;
  };
  const rows: CsvMovementRow[] = ((data ?? []) as Row[]).map((m) => ({
    fecha: m.occurred_at.slice(0, 10),
    tipo: m.type,
    descripcion: m.description,
    monto: m.amount,
    moneda: m.currency,
    categoria: m.category_id,
    subcategoria: m.subcategory_id,
    cuenta: m.account_origin_id,
    caja: null,
    etiquetas: [],
    origen: m.source,
    estado: m.status,
    id_movimiento: m.id,
  }));
  return buildMovementsCsv(rows);
}

// RUL-REP-11: los catorce bloques. Cubre los que ya tienen tabla real hoy;
// "conversaciones" queda vacío porque el motor del asistente (41) todavía
// no existe — se declara explícitamente en vez de omitirse en silencio.
async function buildFullExportJson(client: Client, userId: string): Promise<string> {
  const [
    accounts,
    boxes,
    movements,
    tags,
    debts,
    recurring,
    pending,
    emailSources,
    profileFacts,
    insights,
    downloads,
  ] = await Promise.all([
    client.from("accounts").select("*").eq("user_id", userId),
    client.from("boxes").select("*").eq("user_id", userId),
    client.from("movements").select("*").eq("user_id", userId),
    client.from("tags").select("*").eq("user_id", userId),
    client.from("debts").select("*").eq("user_id", userId),
    client.from("recurring_rules").select("*").eq("user_id", userId),
    client.from("pending_items").select("*").eq("user_id", userId),
    client.from("user_email_sources").select("id,institution_key,notification_sender,status").eq("user_id", userId),
    client.from("user_profile_facts").select("*").eq("user_id", userId),
    client.from("insight_candidates").select("*").eq("user_id", userId),
    client.from("export_jobs").select("id,kind,format,status,requested_at").eq("user_id", userId),
  ]);

  return JSON.stringify(
    {
      cuenta: { user_id: userId, exported_at: new Date().toISOString() },
      movimientos: movements.data ?? [],
      cuentas_y_cajas: { cuentas: accounts.data ?? [], cajas: boxes.data ?? [] },
      categorias: "Las doce categorías globales, ver documentación del producto.",
      etiquetas: tags.data ?? [],
      presupuestos_y_metas: "Ver /api/v1/budgets y /api/v1/goals.",
      deudas: debts.data ?? [],
      recurrentes: recurring.data ?? [],
      pendientes: pending.data ?? [],
      correo: emailSources.data ?? [],
      perfil: profileFacts.data ?? [],
      descubrimientos: insights.data ?? [],
      conversaciones: [],
      descargas: downloads.data ?? [],
    },
    null,
    2,
  );
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
