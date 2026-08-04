import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import { getExperiencePreferences } from "@/data/repositories/experience-preferences.repository";

export const dynamic = "force-dynamic";

// `45` §8 — punto único de decisión del modo discreto (`RUL-CONF-03`,
// `AC-CONF-03`). Ruta propia y no un campo dentro de otra respuesta para
// que sea evidente en el código quién la consulta (`AC-CONF-03`), y para
// que exista un solo lugar que probar. Reusa la misma lectura que ya sirve
// al layout de `(app)` (`getExperiencePreferences`), nunca una copia.
export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const preferences = await getExperiencePreferences(auth.client, auth.userId);
    return okJson(
      { discreet_mode_enabled: preferences.discreet_mode_enabled },
      meta,
      { headers: { "cache-control": "private, no-store" } },
    );
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
