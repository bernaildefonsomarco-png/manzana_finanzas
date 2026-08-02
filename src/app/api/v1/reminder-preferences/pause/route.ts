import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { pauseReminders, ReminderRepositoryError } from "@/data/repositories/reminders.repository";
import { isZodLike, reminderOperationError } from "../../reminders/operation-http";

export const dynamic = "force-dynamic";
const BodySchema = z.object({ until: z.string().datetime().optional() }).strict();

// POST /reminder-preferences/pause (ACT-NOTIF-08): pausa una semana por
// defecto si no se especifica fecha.
export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const body = BodySchema.parse(await request.json().catch(() => ({})));
    const until = body.until ?? new Date(Date.now() + 7 * 86_400_000).toISOString();
    await pauseReminders(auth.client, auth.userId, until);
    return okJson({ paused_until: until }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    if (error instanceof ReminderRepositoryError) return reminderOperationError(error, meta);
    return unexpectedError(error, meta);
  }
}
