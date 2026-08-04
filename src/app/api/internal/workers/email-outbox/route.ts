import { z } from "zod";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { createEmailSender } from "@/adapters/email/outbound-sender";
import { decideSend, type SendPolicyInput } from "@/core/email-outbox/send-policy";
import { renderTransactionalEmail } from "@/core/email-outbox/template";
import {
  claimPendingEmails,
  isAddressSuppressed,
  markEmailDeferred,
  markEmailDiscarded,
  markEmailFailed,
  markEmailSent,
  type EmailOutboxRow,
} from "@/data/repositories/email-outbox.repository";
import { finishWorkerJobRun, startWorkerJobRun } from "@/data/repositories/worker-operations.repository";
import { createServiceClient } from "@/data/supabase/server";
import { logger } from "@/shared/telemetry/logger";

export const dynamic = "force-dynamic";

const RequestSchema = z.object({ max_jobs: z.coerce.number().int().min(1).max(100).optional() }).strict();

// `46` `RUL-MAIL-02` — trabajador que saca correos de la cola. Las plantillas
// de notificación (los diez tipos de `37`) no tienen todavía un disparador
// real conectado a este corte (`W-19` no reconstruye `37`); lo que este
// trabajador cierra hoy es el camino transaccional completo (§4.2 "tu
// descarga está lista") y la política de envío para cuando los tipos de
// notificación empiecen a encolar. Documentado en el ledger, no oculto.
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
    const client = createServiceClient();
    const sender = createEmailSender();
    const run = await startWorkerJobRun(client, {
      job_name: "email_outbox_send",
      trigger: request.method === "GET" ? "cron_get" : "worker_post",
      trace_id,
      metadata: { max_jobs: max_jobs ?? 25 },
    });

    const pending = await claimPendingEmails(client, max_jobs ?? 25);
    let sent = 0;
    let discarded = 0;
    let deferred = 0;
    let failed = 0;

    for (const row of pending) {
      try {
        const outcome = await processOne(client, sender, row);
        if (outcome === "enviado") sent += 1;
        else if (outcome === "diferido") deferred += 1;
        else discarded += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : "unknown_error";
        await markEmailFailed(client, row, message);
        logger.error("email_outbox.send_failed", { trace_id, email_id: row.id, error: message });
      }
    }

    await finishWorkerJobRun(client, {
      run,
      status:
        failed > 0 && sent === 0 && discarded === 0 && deferred === 0
          ? "failed"
          : failed > 0
            ? "partial"
            : "succeeded",
      claimed_count: pending.length,
      processed_count: sent + discarded + deferred,
      failed_count: failed,
      result: { sent, discarded, deferred, failed },
    });

    return okJson({ worker: "email_outbox_send", sent, discarded, deferred, failed }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

async function processOne(
  client: ReturnType<typeof createServiceClient>,
  sender: ReturnType<typeof createEmailSender>,
  row: EmailOutboxRow,
): Promise<"enviado" | "descartado" | "diferido"> {
  const suppressed = await isAddressSuppressed(client, row.user_id);

  // `46` §9: cada trabajo transaccional trae su contenido ya resuelto por
  // quien lo encoló (el `subject` guardado); los de notificación con
  // política completa (tipo/causa/horario/límite) llegan en un corte que
  // conecte los diez tipos de `37` — hoy el único productor real es
  // transaccional, así que la entrada de política refleja eso.
  const policyInput: SendPolicyInput = {
    kind: row.kind,
    typeStillActive: true,
    causeStillValid: true,
    addressSuppressed: suppressed,
    withinQuietHours: false,
    dailyLimitReached: false,
  };
  const decision = decideSend(policyInput);

  if (decision.action === "discard") {
    await markEmailDiscarded(client, row.id, decision.reason);
    return "descartado";
  }
  if (decision.action === "defer") {
    // `RUL-MAIL-03`: lo que cae en horario silencioso o límite diario se
    // **difiere, no se descarta** — con la entrada actual (horario/límite
    // siempre `false`, ver comentario de `policyInput` arriba) esta rama no
    // se alcanza todavía; queda correcta para cuando un productor real de
    // notificaciones (`37`) sí calcule esas dos condiciones.
    const retryAt = new Date(Date.now() + 30 * 60_000).toISOString();
    await markEmailDeferred(client, row.id, retryAt);
    return "diferido";
  }

  const rendered = renderTransactionalEmail({
    subject: row.subject,
    bodyLines: ["Contenido generado por la plantilla en el momento del envío."],
  });

  const { data: userData } = await client.auth.admin.getUserById(row.user_id);
  const to = userData?.user?.email;
  if (!to) {
    await markEmailDiscarded(client, row.id, "sin_direccion");
    return "descartado";
  }

  const result = await sender.send({
    to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: rendered.headers,
  });
  if (!result.ok) throw new Error(result.error);

  await markEmailSent(client, row.id);
  return "enviado";
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
