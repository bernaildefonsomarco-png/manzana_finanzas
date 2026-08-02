import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import {
  getReminderPause,
  getReminderPreferences,
  ReminderRepositoryError,
  setReminderPreference,
} from "@/data/repositories/reminders.repository";
import { REMINDER_KINDS, type ReminderKind } from "@/shared/types/domain";
import { isZodLike, reminderOperationError } from "../reminders/operation-http";

export const dynamic = "force-dynamic";

const ALL_KINDS = [...REMINDER_KINDS] as ReminderKind[];

// GET /reminder-preferences (37 §10): por tipo y canal.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const [preferences, pause] = await Promise.all([
      getReminderPreferences(auth.client, auth.userId, ALL_KINDS),
      getReminderPause(auth.client, auth.userId),
    ]);
    return okJson({ preferences, paused_until: pause?.paused_until ?? null }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

const PatchSchema = z
  .object({
    nudge_type: z.enum(ALL_KINDS as [ReminderKind, ...ReminderKind[]]),
    channel: z.enum(["dashboard", "email"]),
    enabled: z.boolean(),
  })
  .strict();

// PATCH /reminder-preferences: cambia un tipo/canal. Activar el correo de
// un tipo (channel=email, enabled=true) registra consentimiento explícito
// (AC-NOTIF-03, dentro de la RPC).
export async function PATCH(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const body = PatchSchema.parse(await request.json().catch(() => ({})));
    await setReminderPreference(auth.client, auth.userId, {
      nudgeType: body.nudge_type,
      channel: body.channel,
      enabled: body.enabled,
    });
    return okJson({ ...body }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    if (error instanceof ReminderRepositoryError) return reminderOperationError(error, meta);
    return unexpectedError(error, meta);
  }
}
