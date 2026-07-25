import { ClassificationCommandDispatcher } from "@/core/classification";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";
import { getClassificationCatalog } from "@/data/repositories/classification.repository";
import { CreateSubcategoryRequestSchema } from "../classification/schemas";
import { classificationCommand, isConflictError, isZodLike } from "../classification/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const catalog = await getClassificationCatalog(auth.client, auth.userId);
    return okJson({ subcategories: catalog.subcategories }, meta);
  } catch (error) { return unexpectedError(error, meta); }
}

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const parsed = CreateSubcategoryRequestSchema.parse(await readJsonBody(request));
    const dispatcher = new ClassificationCommandDispatcher(createServiceClient());
    const result = await dispatcher.dispatch(classificationCommand({
      type: "CreateUserSubcategoryCommand", userId: auth.userId, traceId: meta.trace_id,
      source: "api.v1.subcategories.post",
      payload: { ...parsed, created_by: "user", confirmed_by_user: true },
    }));
    return okJson({ subcategory: result.entity }, meta, { status: 201 });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    if (isConflictError(error)) return errorJson("CONFLICT", "Esa subcategoria ya existe.", meta, 409);
    return unexpectedError(error, meta);
  }
}

