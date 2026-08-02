import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import { countOpenReminders } from "@/data/repositories/reminders.repository";

export const dynamic = "force-dynamic";

// GET /reminders/count (37 §10): solo el badge, bajo 100ms — consulta de
// conteo sobre el índice parcial `in_app_notifications_open_idx`.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const count = await countOpenReminders(auth.client, auth.userId);
    // RUL-NOTIF-09: se muestra como máximo "9+".
    return okJson({ count: Math.min(count, 9), exceeds_display_max: count > 9 }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
