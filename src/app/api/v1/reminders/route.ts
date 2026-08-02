import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { listReminders } from "@/data/repositories/reminders.repository";
import { isZodLike } from "./operation-http";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    estado: z.enum(["abiertos", "cerrados"]).optional(),
  })
  .strict();

// GET /reminders (37 §10): abiertos por defecto, ordenados por prioridad.
// Colección sin recurso identificable: aislamiento se prueba con 200 y
// exclusivamente datos del usuario autenticado (WEB-D230).
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const reminders = await listReminders(auth.client, auth.userId, { estado: query.estado });
    return okJson({ reminders }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
