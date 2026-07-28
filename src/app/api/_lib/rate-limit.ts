// Limite de peticiones (`14` §8, `AC-API-06`, `WEB-D179`, `WEB-D180`). Se
// llama desde `src/proxy.ts` para toda peticion a `/api/v1/*`: es el unico
// punto por el que pasan todas, exista la ruta hoy o se cree despues
// (`budgets`, `assistant`, etc. — `WEB-D175`), asi que el clasificador cubre
// las 18 familias de `14` §10 aunque la mayoria de sus rutas no existan aun.
//
// No incluye "autenticacion"/"recuperacion de contraseña"/"registro":
// esas llamadas van del navegador directo a la API de Supabase Auth, nunca
// pasan por `proxy.ts` (`WEB-D181`).

export type RateLimitFamily =
  | "reads"
  | "financial_writes"
  | "assistant"
  | "imports"
  | "exports";

export type RateLimitRule = { windowSeconds: number; maxCount: number };

export const RATE_LIMIT_RULES: Record<RateLimitFamily, RateLimitRule> = {
  reads: { windowSeconds: 60, maxCount: 300 },
  financial_writes: { windowSeconds: 60, maxCount: 60 },
  assistant: { windowSeconds: 60, maxCount: 20 },
  imports: { windowSeconds: 3600, maxCount: 5 },
  exports: { windowSeconds: 3600, maxCount: 3 },
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Prefijos con familia propia (`14` §10), sin importar el metodo: son mas
// caros que una lectura normal aunque el verbo HTTP sea GET.
const DEDICATED_FAMILY_PREFIXES: Array<{ prefix: string; family: RateLimitFamily }> = [
  { prefix: "/api/v1/assistant", family: "assistant" },
  { prefix: "/api/v1/imports", family: "imports" },
  { prefix: "/api/v1/exports", family: "exports" },
];

export function classifyRateLimitFamily(
  pathname: string,
  method: string
): RateLimitFamily {
  const dedicated = DEDICATED_FAMILY_PREFIXES.find(({ prefix }) =>
    pathname.startsWith(prefix)
  );
  if (dedicated) return dedicated.family;

  return WRITE_METHODS.has(method.toUpperCase()) ? "financial_writes" : "reads";
}

export type RateLimitCheckResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

export type RateLimitClient = {
  rpc(
    fn: "check_and_increment_rate_limit",
    args: {
      p_key: string;
      p_window_seconds: number;
      p_max_count: number;
      p_now: string;
    }
  ): Promise<{
    data: { allowed: boolean; retry_after_seconds: number } | null;
    error: { message: string } | null;
  }>;
};

export async function checkRateLimit(
  client: RateLimitClient,
  input: { key: string; family: RateLimitFamily; now?: Date }
): Promise<RateLimitCheckResult> {
  const rule = RATE_LIMIT_RULES[input.family];
  const now = input.now ?? new Date();

  const { data, error } = await client.rpc("check_and_increment_rate_limit", {
    p_key: `${input.family}:${input.key}`,
    p_window_seconds: rule.windowSeconds,
    p_max_count: rule.maxCount,
    p_now: now.toISOString(),
  });

  // Ante un fallo de infraestructura (RPC caido), no se bloquea al usuario
  // por un problema nuestro: se deja pasar. El limite es proteccion contra
  // abuso, no una comprobacion de seguridad que deba fallar cerrado.
  if (error || !data) return { allowed: true };

  return data.allowed
    ? { allowed: true }
    : { allowed: false, retryAfterSeconds: data.retry_after_seconds };
}
