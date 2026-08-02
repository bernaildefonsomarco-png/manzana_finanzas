import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { dismissReminder, ReminderRepositoryError } from "@/data/repositories/reminders.repository";
import { isZodLike, reminderOperationError } from "../../operation-http";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

// POST /reminders/[id]/dismiss (37 §10): idempotente salvo sobre uno ya
// resuelto (ERR-NOTIF-04), donde falla por diseño.
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);
    await dismissReminder(auth.client, auth.userId, id);
    return okJson({ id, dismissed: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    if (error instanceof ReminderRepositoryError) return reminderOperationError(error, meta);
    return unexpectedError(error, meta);
  }
}
