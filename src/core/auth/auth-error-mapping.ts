// `43` RUL-AUTH-05 — los errores de autenticación se mapean por el código
// del proveedor, nunca por el texto de su mensaje. Los códigos de esta
// lista son los reales de `@supabase/auth-js` (`error-codes.d.ts`), no
// inventados: un código que no está aquí cae en `ERR-AUTH-11` y emite
// alerta (`AC-AUTH-02`), en vez de fallar en silencio.
//
// `ERR-AUTH-07` ("ese enlace ya se usó") no tiene código propio en el SDK:
// tanto un enlace caducado como uno ya usado devuelven `flow_state_expired`
// o `flow_state_not_found` desde el intercambio PKCE de `/auth/callback`
// (`43` §8 `SCR-AUTH-06`). Se mapean juntos a `ERR-AUTH-06`/`07` según cuál
// da el proveedor, sin inventar una distinción que la API no ofrece.

import { logger } from "@/shared/telemetry/logger";

export type AuthErrorId =
  | "ERR-AUTH-01"
  | "ERR-AUTH-02"
  | "ERR-AUTH-03"
  | "ERR-AUTH-04"
  | "ERR-AUTH-05"
  | "ERR-AUTH-06"
  | "ERR-AUTH-07"
  | "ERR-AUTH-08"
  | "ERR-AUTH-09"
  | "ERR-AUTH-10"
  | "ERR-AUTH-11"
  | "ERR-AUTH-12";

export type AuthErrorAction =
  | "reintentar"
  | "recuperar"
  | "crear_cuenta"
  | "reenviar"
  | "entrar"
  | "corregir"
  | "esperar"
  | "pedir_otro"
  | "ir_al_inicio";

export type MappedAuthError = {
  id: AuthErrorId;
  message: string;
  actions: AuthErrorAction[];
};

export type AuthFlowMode = "login" | "signup" | "recovery" | "resend" | "generic";

/** Segundos hasta poder reintentar, si el proveedor lo declaró. */
function retryClause(retryAfterSeconds: number | undefined, now: () => Date): string {
  if (!retryAfterSeconds || retryAfterSeconds <= 0) {
    return "Prueba otra vez en unos minutos.";
  }
  const retryAt = new Date(now().getTime() + retryAfterSeconds * 1000);
  const hhmm = new Intl.DateTimeFormat("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/Lima",
  }).format(retryAt);
  return `Prueba otra vez a las ${hhmm}.`;
}

const KNOWN_CODES: Record<string, (ctx: MapContext) => MappedAuthError> = {
  invalid_credentials: () => ({
    id: "ERR-AUTH-01",
    message:
      "El correo o la contraseña no coinciden. Revísalos, o crea una cuenta si aún no tienes.",
    actions: ["reintentar", "recuperar", "crear_cuenta"],
  }),
  email_not_confirmed: () => ({
    id: "ERR-AUTH-02",
    message: "Aún falta confirmar tu correo. Te reenvío el enlace si quieres.",
    actions: ["reenviar"],
  }),
  user_already_exists: () => ({
    id: "ERR-AUTH-03",
    message: "Ese correo ya tiene una cuenta.",
    actions: ["entrar", "recuperar"],
  }),
  email_exists: () => ({
    id: "ERR-AUTH-03",
    message: "Ese correo ya tiene una cuenta.",
    actions: ["entrar", "recuperar"],
  }),
  weak_password: () => ({
    id: "ERR-AUTH-04",
    message: "Elige una contraseña de al menos 8 caracteres.",
    actions: ["corregir"],
  }),
  over_request_rate_limit: (ctx) => ({
    id: "ERR-AUTH-05",
    message: `Demasiados intentos seguidos. ${retryClause(ctx.retryAfterSeconds, ctx.now)}`,
    actions: ["esperar", "recuperar"],
  }),
  over_email_send_rate_limit: (ctx) => ({
    id: "ERR-AUTH-05",
    message: `Demasiados intentos seguidos. ${retryClause(ctx.retryAfterSeconds, ctx.now)}`,
    actions: ["esperar", "recuperar"],
  }),
  otp_expired: () => ({
    id: "ERR-AUTH-06",
    message: "Ese enlace ya caducó.",
    actions: ["pedir_otro"],
  }),
  flow_state_expired: () => ({
    id: "ERR-AUTH-06",
    message: "Ese enlace ya caducó.",
    actions: ["pedir_otro"],
  }),
  flow_state_not_found: () => ({
    id: "ERR-AUTH-07",
    message: "Ese enlace ya se usó.",
    actions: ["pedir_otro", "entrar"],
  }),
  session_expired: () => ({
    id: "ERR-AUTH-08",
    message: "Pasó un rato sin actividad. Vuelve a entrar y sigues donde estabas.",
    actions: ["entrar"],
  }),
  session_not_found: () => ({
    id: "ERR-AUTH-08",
    message: "Pasó un rato sin actividad. Vuelve a entrar y sigues donde estabas.",
    actions: ["entrar"],
  }),
  same_password: () => ({
    id: "ERR-AUTH-09",
    message: "Esa es la contraseña que ya tienes.",
    actions: ["corregir"],
  }),
};

type MapContext = {
  mode: AuthFlowMode;
  retryAfterSeconds?: number;
  now: () => Date;
  traceId?: string;
};

const genericByMode: Record<AuthFlowMode, string> = {
  login: "No pude iniciar sesión ahora. Tus datos están a salvo; inténtalo de nuevo.",
  signup: "No pude crear la cuenta ahora. Tus datos están a salvo; inténtalo de nuevo.",
  recovery: "No pude completar eso ahora. Tus datos están a salvo; inténtalo de nuevo.",
  resend: "No pude reenviar el enlace ahora. Inténtalo de nuevo.",
  generic: "No pude completar eso ahora. Tus datos están a salvo; inténtalo de nuevo.",
};

/**
 * Mapea el `code` que devuelve `@supabase/auth-js` a un error en español con
 * salida (`RUL-AUTH-05`). Un código desconocido produce el mensaje genérico
 * **y emite alerta de observabilidad** (`AC-AUTH-02`): nunca se propaga el
 * texto crudo del proveedor (`AC-AUTH-01`).
 */
export function mapAuthErrorCode(
  code: string | undefined | null,
  options: {
    mode: AuthFlowMode;
    retryAfterSeconds?: number;
    now?: () => Date;
    traceId?: string;
  }
): MappedAuthError {
  const ctx: MapContext = {
    mode: options.mode,
    retryAfterSeconds: options.retryAfterSeconds,
    now: options.now ?? (() => new Date()),
    traceId: options.traceId,
  };

  const handler = code ? KNOWN_CODES[code] : undefined;
  if (handler) return handler(ctx);

  logger.error("cuenta.error_sin_traducir", {
    trace_id: ctx.traceId,
    operation: "auth.map_error_code",
    provider_code: code ?? "(sin código)",
    mode: ctx.mode,
  });

  return {
    id: "ERR-AUTH-11",
    message: genericByMode[ctx.mode],
    actions: ["reintentar"],
  };
}

/** `ERR-AUTH-12`: sin conexión, no llega ningún código del proveedor. */
export function offlineAuthError(): MappedAuthError {
  return {
    id: "ERR-AUTH-12",
    message: "Parece que no hay conexión. Lo que escribiste sigue aquí.",
    actions: ["reintentar"],
  };
}
