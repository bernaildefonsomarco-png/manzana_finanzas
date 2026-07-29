import { ClassificationCommandDispatcher } from "@/core/classification";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { clampLimit, decodeCursor, paginateInMemory } from "@/app/api/_lib/pagination";
import { createServiceClient } from "@/data/supabase/server";
import {
  getClassificationCatalog,
  getSubcategoryMovementCounts,
} from "@/data/repositories/classification.repository";
import { CreateSubcategoryRequestSchema, ListClassificationQuerySchema } from "../classification/schemas";
import { classificationCommand, isConflictError, isZodLike } from "../classification/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const query = ListClassificationQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const [catalog, counts] = await Promise.all([
      getClassificationCatalog(auth.client, auth.userId),
      getSubcategoryMovementCounts(auth.client),
    ]);
    const countBySubcategory = new Map(counts.map((c) => [c.subcategory_id, c.movement_count]));
    // SCR-CAT-02/03: filtro por categoria, conteo de movimientos, y orden
    // "las mas usadas primero".
    const withCounts = catalog.subcategories
      .filter((subcategory) => !query.category_id || subcategory.category_id === query.category_id)
      .map((subcategory) => ({
        ...subcategory,
        movement_count: countBySubcategory.get(subcategory.id) ?? 0,
      }))
      .sort((a, b) => b.movement_count - a.movement_count);
    const { data: pageRows, page } = paginateInMemory(withCounts, limit, cursor);

    return okJson({ subcategories: pageRows }, { ...meta, page });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
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

