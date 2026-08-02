import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import { markAllRemindersRead } from "@/data/repositories/reminders.repository";

export const dynamic = "force-dynamic";

// POST /reminders/read-all (37 §10): al abrir la bandeja.
export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    await markAllRemindersRead(auth.client, auth.userId);
    return okJson({ read: true }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
