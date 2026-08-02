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
  ClassificationOperationError,
  mergeSubcategories,
  undoClassificationBatch,
} from "@/data/repositories/classification.repository";
import {
  ClassificationIdParamsSchema,
  MergeSubcategoryRequestSchema,
} from "@/app/api/v1/classification/schemas";
import { classificationOperationErrorJson } from "@/app/api/v1/classification/operation-http";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para fusionar o deshacer.",
        meta,
        400,
      );
    }
    const { id } = ClassificationIdParamsSchema.parse(await context.params);
    const parsed = MergeSubcategoryRequestSchema.parse(await readJsonBody(request));
    const result = "undo_batch_id" in parsed
      ? await undoClassificationBatch(auth.client, {
          userId: auth.userId,
          batchId: parsed.undo_batch_id,
          expectedKind: "merge",
          expectedSourceId: id,
          idempotencyKey,
        })
      : await mergeSubcategories(auth.client, {
          userId: auth.userId,
          sourceId: id,
          targetId: parsed.target_subcategory_id,
          preview: parsed.preview,
          idempotencyKey,
        });
    return okJson(
      result.preview ? { preview: result } : { batch: result.batch },
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
