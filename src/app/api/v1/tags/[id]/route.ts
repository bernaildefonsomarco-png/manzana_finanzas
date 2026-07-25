import { ClassificationCommandDispatcher } from "@/core/classification";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";
import { ClassificationIdParamsSchema, UpdateTagRequestSchema } from "../../classification/schemas";
import { classificationCommand, isConflictError, isNotFoundError, isZodLike } from "../../classification/route-helpers";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request); if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ClassificationIdParamsSchema.parse(await context.params);
    const payload = UpdateTagRequestSchema.parse(await readJsonBody(request));
    const result = await new ClassificationCommandDispatcher(createServiceClient()).dispatch(classificationCommand({
      type: "UpdateUserTagCommand", userId: auth.userId, traceId: meta.trace_id,
      source: "api.v1.tags.patch", payload: { tag_id: id, ...payload },
    }));
    return okJson({ tag: result.entity }, meta);
  } catch (error) { return classificationMutationError(error, meta); }
}

export async function DELETE(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request); if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ClassificationIdParamsSchema.parse(await context.params);
    const result = await new ClassificationCommandDispatcher(createServiceClient()).dispatch(classificationCommand({
      type: "ArchiveUserTagCommand", userId: auth.userId, traceId: meta.trace_id,
      source: "api.v1.tags.delete", payload: { tag_id: id },
    }));
    return okJson({ tag: result.entity }, meta);
  } catch (error) { return classificationMutationError(error, meta); }
}

function classificationMutationError(error: unknown, meta: { trace_id: string }) {
  if (isZodLike(error)) return validationError(error, meta);
  if (isConflictError(error)) return errorJson("CONFLICT", "Esa etiqueta ya existe.", meta, 409);
  if (isNotFoundError(error)) return errorJson("NOT_FOUND", "Etiqueta no encontrada.", meta, 404);
  return unexpectedError(error, meta);
}

