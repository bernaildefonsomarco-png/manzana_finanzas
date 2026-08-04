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
import { mapAuthErrorCode } from "@/core/auth/auth-error-mapping";
import { recordAccountEvent, requestMeta } from "@/core/auth/account-events";

export const dynamic = "force-dynamic";

// `43` `PATCH /auth/email` — sesión activa obligatoria. `RUL-AUTH-08`
// exige avisar a la dirección antigua con un enlace de revertir 24 h: eso
// lo entrega el "Secure email change" de Supabase Auth (confirma en ambas
// direcciones), una configuración del proyecto, no de esta ruta — se deja
// anotado en el ledger de cierre en vez de fingir que el código por sí
// solo lo garantiza (`RUL-HECHO-04`).
const EmailSchema = z
  .object({ new_email: z.string().trim().toLowerCase().email() })
  .strict();

export async function PATCH(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const body = EmailSchema.parse(await readJsonBody(request));

    const { error: updateError } = await auth.client.auth.updateUser({
      email: body.new_email,
    });
    if (updateError) {
      const mapped = mapAuthErrorCode(updateError.code, {
        mode: "generic",
        traceId: meta.trace_id,
      });
      return errorJson("VALIDATION_ERROR", mapped.message, meta, 400);
    }

    const { ip, userAgent } = requestMeta(request);
    await recordAccountEvent(auth.client, {
      userId: auth.userId,
      kind: "correo_cambiado",
      ip,
      userAgent,
    });

    return okJson({ confirmation_sent: true }, meta);
  } catch (error) {
    if (isZodLike(error)) {
      return validationError(error, meta, "Escribe un correo válido.");
    }
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
