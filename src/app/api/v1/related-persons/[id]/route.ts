import { ClassificationCommandDispatcher } from "@/core/classification";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";
import { ClassificationIdParamsSchema, UpdateRelatedPersonRequestSchema } from "../../classification/schemas";
import { classificationCommand, isConflictError, isNotFoundError, isZodLike } from "../../classification/route-helpers";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request); if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ClassificationIdParamsSchema.parse(await context.params);
    const parsed = UpdateRelatedPersonRequestSchema.parse(await readJsonBody(request));
    const result = await new ClassificationCommandDispatcher(createServiceClient()).dispatch(classificationCommand({
      type: "UpdateRelatedPersonCommand", userId: auth.userId, traceId: meta.trace_id,
      source: "api.v1.related_persons.patch",
      payload: { related_person_id: id, display_name: parsed.display_name, kind: parsed.kind, relationship_label: parsed.relationship_label ?? null },
    }));
    return okJson({ related_person: result.entity }, meta);
  } catch (error) { return classificationMutationError(error, meta); }
}

export async function DELETE(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request); if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ClassificationIdParamsSchema.parse(await context.params);
    const result = await new ClassificationCommandDispatcher(createServiceClient()).dispatch(classificationCommand({
      type: "ArchiveRelatedPersonCommand", userId: auth.userId, traceId: meta.trace_id,
      source: "api.v1.related_persons.delete", payload: { related_person_id: id },
    }));
    return okJson({ related_person: result.entity }, meta);
  } catch (error) { return classificationMutationError(error, meta); }
}

function classificationMutationError(error: unknown, meta: { trace_id: string }) {
  if (isZodLike(error)) return validationError(error, meta);
  if (isConflictError(error)) return errorJson("CONFLICT", "Esa persona ya existe.", meta, 409);
  if (isNotFoundError(error)) return errorJson("NOT_FOUND", "Persona no encontrada.", meta, 404);
  return unexpectedError(error, meta);
}

