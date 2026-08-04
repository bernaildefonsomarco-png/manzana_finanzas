import { z } from "zod";
import {
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { getClientIp } from "@/app/api/_lib/client-ip";
import type { RateLimitClient } from "@/app/api/_lib/rate-limit";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

// `43` `RUL-AUTH-06` — límites de intento para los cuatro flujos que nunca
// tocan nuestro servidor (`WEB-D181`): entrar, registrarse, recuperar
// contraseña y reenviar verificación van del navegador directo a la API de
// Supabase Auth, así que `check_and_increment_rate_limit` (`WEB-D179`,
// migración `047`) no los ve pasar por `src/proxy.ts` — esa ruta solo
// clasifica `/api/v1/*` por las familias de `14` §8, que no incluyen
// autenticación. `WEB-D181` encarga a este corte reusar ese mismo RPC con
// una clave propia; esta ruta es el único punto que lo hace: el cliente la
// llama antes de intentar contra Supabase y, si no está permitido, ni
// siquiera intenta.
//
// Un límite "nunca bloquea la cuenta: ralentiza el intento" (`RUL-AUTH-06`):
// por eso esto es un contador de ventana deslizante, no un candado que se
// abre con una acción distinta.

const AttemptSchema = z
  .object({
    kind: z.enum(["sign_in", "sign_up", "password_reset", "resend_verification"]),
    email: z.string().trim().toLowerCase().email(),
  })
  .strict();

type AttemptKind = z.infer<typeof AttemptSchema>["kind"];

const RULES: Record<AttemptKind, { windowSeconds: number; maxCount: number; byIp: boolean }> = {
  // "Intentos de entrar: 5 en 15 minutos, por correo y por IP"
  sign_in: { windowSeconds: 15 * 60, maxCount: 5, byIp: true },
  // "Registro: 5 por hora y por IP"
  sign_up: { windowSeconds: 60 * 60, maxCount: 5, byIp: true },
  // "Recuperación de contraseña: 3 por hora" — clave por correo. `RUL-AUTH-01`
  // exige que la respuesta nunca distinga si el correo tiene cuenta, así que
  // se limita por el correo escrito, exista cuenta o no.
  password_reset: { windowSeconds: 60 * 60, maxCount: 3, byIp: false },
  // "Reenvío de verificación: 3 por hora"
  resend_verification: { windowSeconds: 60 * 60, maxCount: 3, byIp: false },
};

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const body = AttemptSchema.parse(await readJsonBody(request));
    const rule = RULES[body.kind];
    const client = createServiceClient() as unknown as RateLimitClient;

    const keys = [`auth_${body.kind}:email:${body.email}`];
    if (rule.byIp) keys.push(`auth_${body.kind}:ip:${getClientIp(request)}`);

    const checks = await Promise.all(keys.map((key) => checkAuthRateLimit(client, key, rule)));
    const blocked = checks.find((c) => !c.allowed);

    if (blocked) {
      const response = okJson(
        { allowed: false, retry_after_seconds: blocked.retryAfterSeconds },
        meta,
      );
      response.headers.set("Retry-After", String(blocked.retryAfterSeconds));
      return response;
    }

    return okJson({ allowed: true, retry_after_seconds: 0 }, meta);
  } catch (error) {
    if (isZodLike(error)) {
      return validationError(error, meta, "Correo inválido.");
    }
    return unexpectedError(error, meta);
  }
}

async function checkAuthRateLimit(
  client: RateLimitClient,
  key: string,
  rule: { windowSeconds: number; maxCount: number },
): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const { data, error } = await client.rpc("check_and_increment_rate_limit", {
    p_key: key,
    p_window_seconds: rule.windowSeconds,
    p_max_count: rule.maxCount,
    p_now: new Date().toISOString(),
  });
  // Fallo de infraestructura: no se bloquea al usuario por un problema
  // nuestro (mismo criterio que `src/proxy.ts`).
  if (error || !data) return { allowed: true, retryAfterSeconds: 0 };
  return data.allowed
    ? { allowed: true, retryAfterSeconds: 0 }
    : { allowed: false, retryAfterSeconds: data.retry_after_seconds };
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
