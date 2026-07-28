import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

export async function proxy(request: NextRequest) {
  if (isPublicPath(request.nextUrl.pathname)) {
    return NextResponse.next();
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
  await supabase.auth.getUser();

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
