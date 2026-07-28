// `Idempotency-Key` (`14` §7, `AC-API-05`): al menos 8 caracteres. El tope de
// 180 no es del documento, es cordura de cabecera HTTP y ya lo aplicaban
// varias rutas antes de este fichero; se consolida aqui en vez de repetirse.

export const MIN_IDEMPOTENCY_KEY_LENGTH = 8;
export const MAX_IDEMPOTENCY_KEY_LENGTH = 180;

/** `null` si falta la cabecera o no cumple el rango de longitud valido. */
export function readIdempotencyKey(request: Request): string | null {
  const raw = request.headers.get("idempotency-key")?.trim();
  if (!raw) return null;
  if (
    raw.length < MIN_IDEMPOTENCY_KEY_LENGTH ||
    raw.length > MAX_IDEMPOTENCY_KEY_LENGTH
  ) {
    return null;
  }
  return raw;
}
