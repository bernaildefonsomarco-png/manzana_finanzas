import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { ReminderRepositoryError, snoozeReminder } from "@/data/repositories/reminders.repository";
import { isZodLike, reminderOperationError } from "../../operation-http";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({ until: z.string().datetime() }).strict();
type RouteContext = { params: Promise<{ id: string }> };

// POST /reminders/[id]/snooze { until } (37 §10, RUL-NOTIF-10): idempotente
// — reintentar con la misma fecha deja el mismo resultado.
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse(await request.json().catch(() => ({})));

    await snoozeReminder(auth.client, auth.userId, id, body.until);
    return okJson({ id, snoozed_until: body.until }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    if (error instanceof ReminderRepositoryError) return reminderOperationError(error, meta);
    return unexpectedError(error, meta);
  }
}
