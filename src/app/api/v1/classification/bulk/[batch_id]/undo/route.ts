import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import {
  ClassificationOperationError,
  undoClassificationBatch,
} from "@/data/repositories/classification.repository";
import { ClassificationBatchIdParamsSchema } from "../../../schemas";
import { classificationOperationErrorJson } from "../../../operation-http";

export const dynamic = "force-dynamic";
type RouteContext = { params: Promise<{ batch_id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para deshacer el lote.",
        meta,
        400,
      );
    }
    const { batch_id } = ClassificationBatchIdParamsSchema.parse(await context.params);
    const result = await undoClassificationBatch(auth.client, {
      userId: auth.userId,
      batchId: batch_id,
      expectedKind: "bulk",
      idempotencyKey,
    });
    return okJson(
      { batch: result.batch },
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
