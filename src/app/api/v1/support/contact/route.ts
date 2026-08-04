import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { createEmailSender } from "@/adapters/email/outbound-sender";
import { renderTransactionalEmail } from "@/core/email-outbox/template";
import { publicIdentity } from "@/shared/public-identity";

export const dynamic = "force-dynamic";

// `48` `RUL-AYUDA-09`/`ACT-AYUDA-06` — el contacto lleva contexto, nunca
// datos financieros. `context` es lo que el usuario vio y aprobó antes de
// enviar (`AC-AYUDA-09`): ruta actual, `trace_id` del último error si lo
// tiene, y metadatos del entorno — nunca montos, descripciones ni
// conversaciones, y el esquema ni siquiera acepta esos campos.
//
// No pasa por `email_outbox` (`46`): esa cola compone el cuerpo en el
// momento del envío a partir de una entidad ya persistida (`export_jobs`,
// etc.), y un mensaje de soporte no tiene tabla propia donde vivir su
// texto sin duplicar lo que `19` §4.1 prohíbe guardar en registros. Se
// envía directo, sin cola: si falla, el usuario lo ve y puede reintentar
// desde la propia pantalla — mejor que un reintento silencioso en segundo
// plano para un mensaje de una sola vez.
const ContactSchema = z
  .object({
    message: z.string().trim().min(1).max(2000),
    context: z
      .object({
        route: z.string().max(200).optional(),
        last_error_trace_id: z.string().max(100).optional(),
        app_version: z.string().max(50).optional(),
        user_agent: z.string().max(300).optional(),
      })
      .strict(),
  })
  .strict();

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key para enviar el mensaje.", meta, 400);
    }
    const body = ContactSchema.parse(await readJsonBody(request));

    const { data: userData } = await auth.client.auth.getUser();
    const fromEmail = userData?.user?.email ?? "(correo desconocido)";

    const bodyLines = [
      `De: ${fromEmail}`,
      `Pantalla: ${body.context.route ?? "(no declarada)"}`,
      `trace_id del último error: ${body.context.last_error_trace_id ?? "ninguno"}`,
      `Versión: ${body.context.app_version ?? "desconocida"} · ${body.context.user_agent ?? "desconocido"}`,
      "",
      "Mensaje:",
      body.message,
    ];

    const rendered = renderTransactionalEmail({
      subject: "Nuevo mensaje de soporte",
      bodyLines,
    });

    const sender = createEmailSender();
    const result = await sender.send({
      to: publicIdentity.supportEmail,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: { "Reply-To": fromEmail },
    });
    if (!result.ok) throw new Error(result.error);

    return okJson({ sent: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta, "Escribe un mensaje antes de enviar.");
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues),
  );
}
