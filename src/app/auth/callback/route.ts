import { NextResponse } from "next/server";
import { createClient } from "@/data/supabase/server";
import { isKnownInternalRoute } from "@/shared/routing/known-routes";
import { mapAuthErrorCode } from "@/core/auth/auth-error-mapping";
import { getTraceId } from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

// `43` `SCR-AUTH-06` — la ruta que hoy no existía y sin la cual el OAuth de
// Supabase (V1.1) ni la recuperación de contraseña (V1, enlace PKCE) pueden
// completar. Intercambia el código por sesión **en el servidor**
// (`AC-AUTH-05`, `AC-AUTH-14`): nunca en el cliente, porque el token de
// sesión no debe ser accesible desde JavaScript (`AC-AUTH-13`).
export async function GET(request: Request) {
  const traceId = getTraceId(request);
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");
  const errorParam = url.searchParams.get("error");

  // `AC-AUTH-05` — `next` se valida contra una lista de rutas internas
  // conocidas antes de seguirla. Un parámetro de redirección sin validar es
  // una redirección abierta, y en la puerta de autenticación es de las
  // peores: el usuario acaba de escribir su contraseña y confía en dónde se
  // le lleve (`43` §8).
  const safeNext = nextParam && isKnownInternalRoute(nextParam) ? nextParam : null;

  if (errorParam || !code) {
    const mapped = mapAuthErrorCode(errorParam ?? "flow_state_not_found", {
      mode: "recovery",
      traceId,
    });
    return redirectToEntrar(request, mapped.id);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    const mapped = mapAuthErrorCode(error?.code, { mode: "recovery", traceId });
    return redirectToEntrar(request, mapped.id);
  }

  if (safeNext) {
    return NextResponse.redirect(new URL(safeNext, request.url));
  }

  // Primera vez: sin `createdAt` reciente no hay forma barata de saberlo
  // aquí sin una consulta aparte; `44` `SCR-ONB-02` decide la bienvenida por
  // el estado de los datos del usuario, no por este redirect, así que el
  // destino por defecto siempre es `/inicio` (`43` §8) — la bienvenida se
  // muestra desde dentro de `(app)` cuando corresponde, no forzada aquí.
  return NextResponse.redirect(new URL("/inicio", request.url));
}

function redirectToEntrar(request: Request, errorId: string): NextResponse {
  const target = new URL("/entrar", request.url);
  target.searchParams.set("error", errorId);
  return NextResponse.redirect(target);
}
