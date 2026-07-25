import { ClassificationCommandDispatcher } from "@/core/classification";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";
import { getClassificationCatalog } from "@/data/repositories/classification.repository";
import { CreateRelatedPersonRequestSchema } from "../classification/schemas";
import { classificationCommand, isConflictError, isZodLike } from "../classification/route-helpers";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request); if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const catalog = await getClassificationCatalog(auth.client, auth.userId);
    return okJson({ related_people: catalog.related_people }, meta);
  } catch (error) { return unexpectedError(error, meta); }
}

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request); if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const parsed = CreateRelatedPersonRequestSchema.parse(await readJsonBody(request));
    const result = await new ClassificationCommandDispatcher(createServiceClient()).dispatch(classificationCommand({
      type: "CreateRelatedPersonCommand", userId: auth.userId, traceId: meta.trace_id,
      source: "api.v1.related_persons.post",
      payload: { display_name: parsed.display_name, kind: parsed.kind, relationship_label: parsed.relationship_label ?? null, confirmed_by_user: true },
    }));
    return okJson({ related_person: result.entity }, meta, { status: 201 });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    if (isConflictError(error)) return errorJson("CONFLICT", "Esa persona ya existe.", meta, 409);
    return unexpectedError(error, meta);
  }
}

