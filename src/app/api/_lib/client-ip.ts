// IP del cliente a partir de las cabeceras de proxy. Nunca se guarda en
// claro (`AC-AUTH-19`, `43` §4.3): solo se usa para formar una clave de
// límite de intentos o para hashearla antes de persistirla.
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}
