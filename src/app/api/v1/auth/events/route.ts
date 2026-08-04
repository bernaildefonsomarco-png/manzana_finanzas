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
import { recordAccountEvent, requestMeta } from "@/core/auth/account-events";

export const dynamic = "force-dynamic";

// `43` §10 `GET /auth/events` — historial de `account_events` (`43` §4.3).
// `POST` no está en la tabla de `43` §10 porque el documento asume rutas de
// servidor para sign-in/sign-up; `WEB-D181` corrigió eso: esos dos flujos
// van del navegador directo a Supabase Auth (`src/features/auth/auth-screen.tsx`),
// así que no hay una ruta de servidor que ya tenga el momento exacto para
// escribir `cuenta.creada`/`cuenta.sesion_iniciada`. Este `POST` es el punto
// que el cliente llama justo después de que Supabase confirma sesión, con
// la sesión ya activa — la escritura la hace el propio usuario autenticado
// (política `insert own` de la migración `066`), nunca con service-role.
// `account_event_kind` (migración `066`) tiene los siete de `43` §4.3 —
// "creada", "verificada", "clave_cambiada", etc. — y no incluye
// entrar/salir de sesión: son eventos demasiado frecuentes para aportar
// auditoría de seguridad distinta de lo que ya registra Supabase, y
// viven en la telemetría general (`19`) en vez de en esta tabla. Este
// endpoint solo acepta los eventos cuya acción real ocurre puramente en el
// cliente contra la API de Supabase Auth (`WEB-D181`) y que ninguna ruta de
// servidor observa de otro modo: crear la cuenta, recuperar la contraseña
// (`src/features/auth/reset-password-screen.tsx`, tras `/auth/callback`) y
// salir en todos los dispositivos (`src/core/auth/sign-out.ts`,
// `ACT-AUTH-10` — se registra antes de cerrar la sesión actual, porque
// `scope: 'global'` la invalida a ella también). Cambiar la clave con
// sesión activa y cambiar el correo sí pasan por rutas de servidor propias,
// que registran su evento directamente sin pasar por aquí.
const BodySchema = z
  .object({ kind: z.enum(["creada", "clave_recuperada", "sesiones_cerradas"]) })
  .strict();

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const body = BodySchema.parse(await readJsonBody(request));
    const { ip, userAgent } = requestMeta(request);
    await recordAccountEvent(auth.client, {
      userId: auth.userId,
      kind: body.kind,
      ip,
      userAgent,
    });
    return okJson({ recorded: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const { data, error } = await auth.client
      .from("account_events")
      .select("id,kind,created_at")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return okJson({ events: data ?? [] }, meta);
  } catch (error) {
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
