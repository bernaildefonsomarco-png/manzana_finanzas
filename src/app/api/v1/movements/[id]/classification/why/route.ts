import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { getMovementClassificationWhy } from "@/data/repositories/classification.repository";
import { ClassificationIdParamsSchema } from "@/app/api/v1/classification/schemas";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ClassificationIdParamsSchema.parse(await context.params);
    const why = await getMovementClassificationWhy(auth.client, auth.userId, id);
    if (!why) return errorJson("NOT_FOUND", "Movimiento no encontrado.", meta, 404);
    return okJson({ classification: why }, meta);
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
