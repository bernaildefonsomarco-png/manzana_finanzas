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
  classifyMovementsInBulk,
  ClassificationOperationError,
} from "@/data/repositories/classification.repository";
import { BulkClassificationRequestSchema } from "../schemas";
import { classificationOperationErrorJson } from "../operation-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para reclasificar el lote.",
        meta,
        400,
      );
    }
    const parsed = BulkClassificationRequestSchema.parse(await readJsonBody(request));
    const result = await classifyMovementsInBulk(auth.client, {
      userId: auth.userId,
      movementIds: parsed.movement_ids,
      excludedIds: parsed.excluded_ids,
      categoryId: parsed.category_id,
      subcategoryId: parsed.subcategory_id,
      includeManuallyCorrected: parsed.include_manually_corrected,
      preview: parsed.preview,
      idempotencyKey,
    });
    return okJson(
      result.preview
        ? { preview: result }
        : { batch: result.batch },
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
