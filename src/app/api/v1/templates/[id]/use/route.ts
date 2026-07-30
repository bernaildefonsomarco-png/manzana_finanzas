import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import {
  bumpMovementTemplateUse,
  MovementTemplateRepositoryError,
} from "@/data/repositories/movement-templates.repository";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

/**
 * ACT-CAP-05: devuelve la previsualizacion precargada. No escribe el
 * movimiento — eso sigue siendo POST /api/v1/movements (29 S10: ninguna
 * via de captura tiene un camino privilegiado de escritura).
 */
export async function POST(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    const template = await bumpMovementTemplateUse(auth.client, auth.userId, params.id);
    return okJson({ template }, meta);
  } catch (error) {
    if (error instanceof MovementTemplateRepositoryError) {
      if (error.code === "TEMPLATE_NOT_FOUND") {
        return errorJson("NOT_FOUND", "No encontre esa plantilla.", meta, 404);
      }
      return errorJson("INTERNAL_ERROR", "No pude usar la plantilla.", meta, 500);
    }
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
