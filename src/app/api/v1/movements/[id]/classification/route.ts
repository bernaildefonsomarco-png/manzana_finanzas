import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import {
  classifyMovement,
  ClassificationOperationError,
} from "@/data/repositories/classification.repository";
import {
  ClassificationIdParamsSchema,
  MovementClassificationRequestSchema,
} from "@/app/api/v1/classification/schemas";
import { classificationOperationErrorJson } from "@/app/api/v1/classification/operation-http";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para cambiar la clasificacion.",
        meta,
        400,
      );
    }
    const { id } = ClassificationIdParamsSchema.parse(await context.params);
    const parsed = MovementClassificationRequestSchema.parse(await readJsonBody(request));
    const result = await classifyMovement(auth.client, {
      userId: auth.userId,
      movementId: id,
      categoryId: parsed.category_id,
      subcategoryId: parsed.subcategory_id,
      idempotencyKey,
      traceId: meta.trace_id,
    });
    return okJson(
      { movement: result.movement },
      { ...meta, idempotent_replay: result.idempotent || undefined },
    );
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error, meta);
    if (error instanceof ClassificationOperationError) {
      return classificationOperationErrorJson(error, meta);
    }
    return unexpectedError(error, meta);
  }
}
