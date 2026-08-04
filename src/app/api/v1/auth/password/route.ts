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

// `43` `PATCH /auth/password` — sesión activa obligatoria (`43` §10). A
// diferencia de entrar/registrarse/recuperar (`WEB-D181`), este cambio
// ocurre con sesión ya establecida: es una escritura autenticada como
// cualquier otra, así que sí pasa por nuestro servidor — con la sesión de
// cookie del propio usuario (`getApiAuth`), nunca con service-role.
const PasswordSchema = z
  .object({ new_password: z.string().min(8).max(200) })
  .strict();

export async function PATCH(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const body = PasswordSchema.parse(await readJsonBody(request));

    const { error: updateError } = await auth.client.auth.updateUser({
      password: body.new_password,
    });
    if (updateError) {
      const mapped = mapAuthErrorCode(updateError.code, {
        mode: "generic",
        traceId: meta.trace_id,
      });
      return errorJson("VALIDATION_ERROR", mapped.message, meta, 400);
    }

    // `RUL-AUTH-07`: cambiar la contraseña cierra las demás sesiones,
    // nunca la actual.
    await auth.client.auth.signOut({ scope: "others" });

    const { ip, userAgent } = requestMeta(request);
    await recordAccountEvent(auth.client, {
      userId: auth.userId,
      kind: "clave_cambiada",
      ip,
      userAgent,
    });

    return okJson({ changed: true, other_sessions_closed: true }, meta);
  } catch (error) {
    if (isZodLike(error)) {
      return validationError(error, meta, "Elige una contraseña de al menos 8 caracteres.");
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
