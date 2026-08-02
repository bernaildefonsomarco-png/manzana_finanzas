import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import { pickNextAction } from "@/core/home/home-composer";
import { listReminders } from "@/data/repositories/reminders.repository";

export const dynamic = "force-dynamic";

// `39` §10: solo "lo siguiente", para refrescarlo sin recargar el resto del
// Inicio. Colección sin recurso identificable (`WEB-D230`): 200 y datos
// exclusivos del autenticado.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const reminders = await listReminders(auth.client, auth.userId, { estado: "abiertos" });
    const next = pickNextAction(reminders);

    return okJson({ next_action: next }, meta, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
