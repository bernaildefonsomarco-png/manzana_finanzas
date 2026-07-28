// CSRF (`14` §9, `AC-API-07`, `WEB-D180`). Las escrituras autenticadas por
// cookie verifican `Origin`/`Referer` contra el origen propio de la app;
// las peticiones con `Authorization: Bearer` no lo necesitan porque el
// navegador nunca las envia automaticamente entre sitios.

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isWriteMethod(method: string): boolean {
  return WRITE_METHODS.has(method.toUpperCase());
}

export function usesBearerAuth(request: Request): boolean {
  const header = request.headers.get("authorization");
  return Boolean(header && header.toLowerCase().startsWith("bearer "));
}

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * `appOrigin` es la URL propia de la app (`getAppBaseUrl()` de
 * `@/shared/app-links`). Si no se puede determinar (produccion mal
 * configurada, sin `MANZANA_APP_URL`), se falla cerrado: una escritura por
 * cookie sin forma de verificar el origen no se acepta por defecto.
 */
export function verifyOrigin(request: Request, appOrigin: string | null): boolean {
  if (!isWriteMethod(request.method)) return true;
  if (usesBearerAuth(request)) return true;

  const expected = hostOf(appOrigin);
  if (!expected) return false;

  const origin = hostOf(request.headers.get("origin"));
  if (origin) return origin === expected;

  const referer = hostOf(request.headers.get("referer"));
  if (referer) return referer === expected;

  return false;
}
