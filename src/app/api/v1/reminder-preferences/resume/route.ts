import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import { resumeReminders } from "@/data/repositories/reminders.repository";

export const dynamic = "force-dynamic";

// POST /reminder-preferences/resume (ACT-NOTIF-08, deshacer la pausa).
export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    await resumeReminders(auth.client, auth.userId);
    return okJson({ paused: false }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
