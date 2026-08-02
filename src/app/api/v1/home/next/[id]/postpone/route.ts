import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { dismissReminder, ReminderRepositoryError } from "@/data/repositories/reminders.repository";
import { isZodLike, reminderOperationError } from "@/app/api/v1/reminders/operation-http";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

// POST /home/next/[id]/postpone (39 §9 ACT-HOME-05, RUL-HOME-04): "Ahora no"
// oculta hasta que cambie el estado del mundo, no durante un rato — se
// implementa descartando el recordatorio subyacente (37), que solo vuelve a
// aparecer si la próxima evaluación encuentra la misma causa todavía
// vigente (`WEB-D250`). Idempotente salvo sobre uno ya resuelto.
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);
    await dismissReminder(auth.client, auth.userId, id);
    return okJson({ id, postponed: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    if (error instanceof ReminderRepositoryError) return reminderOperationError(error, meta);
    return unexpectedError(error, meta);
  }
}
