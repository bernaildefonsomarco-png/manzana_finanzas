import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getAppBaseUrl } from "@/shared/app-links";
import { errorJson, getTraceId } from "@/app/api/_lib/http";
import { verifyOrigin } from "@/app/api/_lib/csrf";
import {
  checkRateLimit,
  classifyRateLimitFamily,
  type RateLimitClient,
} from "@/app/api/_lib/rate-limit";
import { createServiceClient } from "@/data/supabase/server";

// Rutas públicas de `10_sitemap_rutas_y_navegacion.md` §3.1, más `/estado` y
// `/baja`, que son las dos que ese mapa no conocía (`50` §5.2). No incluye
// `/`: su redirección (`WEB-D151`) la implementa `W-07`, no este proxy —
// añadirla aquí saltaría el refresco de sesión que la SPA de `page.tsx`
// todavía necesita.
export const PUBLIC_PATHS = [
  "/empresa",
  "/privacidad",
  "/terminos",
  "/contacto",
  "/eliminar-datos",
  "/entrar",
  "/crear-cuenta",
  "/recuperar-clave",
  "/restablecer-clave",
  "/verificar",
  "/cuenta-eliminada",
  "/auth/callback",
  "/baja",
  "/estado",
  "/api/health",
  "/api/webhooks/whatsapp",
];

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some(
    (publicPath) =>
      pathname === publicPath || pathname.startsWith(`${publicPath}/`)
  );
}

// `14` §9: cabeceras de seguridad para toda respuesta, publica o no
// (`WEB-D178`: `54` no definia la CSP pese a que `14` decia lo contrario;
// se corrigio ahi mismo). `'unsafe-inline'` en script/style se endurece
// cuando `W-06` elimine los estilos inline de los que Next.js depende hoy.
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://app.posthog.com https://*.sentry.io",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );
  response.headers.set("Content-Security-Policy", CONTENT_SECURITY_POLICY);
  return response;
}

// Mapa ruta→familia de `14` §8: solo `/api/v1/*` pasa por limite de
// peticiones aqui. Autenticacion/recuperacion de clave/registro no
// transitan este proxy en absoluto (`WEB-D181`): van del navegador directo
// a la API de Supabase Auth.
function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return applySecurityHeaders(NextResponse.next());
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refrescar sesión para que no expire
  const { data: userData } = await supabase.auth.getUser();

  // `12` §10: el layout de `(app)` decide con qué mostrar la sesión, pero
  // solo el proxy tiene la URL completa para construir `redirigir`
  // (`10` §8) — un layout de Server Component no la recibe directamente.
  // Comprobación optimista, no de autorización de datos (`12` §10, `15`).
  if (!request.nextUrl.pathname.startsWith("/api") && !userData.user) {
    const redirectUrl = new URL("/entrar", request.url);
    redirectUrl.searchParams.set(
      "redirigir",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return applySecurityHeaders(NextResponse.redirect(redirectUrl));
  }

  if (request.nextUrl.pathname.startsWith("/api/v1")) {
    const meta = { trace_id: getTraceId(request) };

    if (!verifyOrigin(request, getAppBaseUrl())) {
      return applySecurityHeaders(
        errorJson(
          "FORBIDDEN",
          "Origen no permitido para esta escritura.",
          meta,
          403
        )
      );
    }

    const family = classifyRateLimitFamily(
      request.nextUrl.pathname,
      request.method
    );
    const rateLimitKey = userData.user
      ? `user:${userData.user.id}`
      : `ip:${clientIp(request)}`;
    const rateLimit = await checkRateLimit(
      createServiceClient() as unknown as RateLimitClient,
      { key: rateLimitKey, family }
    );

    if (!rateLimit.allowed) {
      const response = errorJson(
        "RATE_LIMITED",
        `Demasiadas peticiones. Vuelve a intentarlo en ${rateLimit.retryAfterSeconds} segundos.`,
        meta,
        429
      );
      response.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
      return applySecurityHeaders(response);
    }
  }

  return applySecurityHeaders(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
