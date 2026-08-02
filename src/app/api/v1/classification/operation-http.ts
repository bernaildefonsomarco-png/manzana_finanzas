import { errorJson, type ApiMeta } from "@/app/api/_lib/http";
import type { ClassificationOperationError } from "@/data/repositories/classification.repository";

export function classificationOperationErrorJson(
  error: ClassificationOperationError,
  meta: ApiMeta,
) {
  if ([
    "MOVEMENT_NOT_FOUND",
    "SUBCATEGORY_NOT_FOUND",
    "CLASSIFICATION_BATCH_NOT_FOUND",
  ].includes(error.code)) {
    return errorJson("NOT_FOUND", error.message, meta, 404);
  }
  if (error.code === "CATEGORY_NOT_FOUND") {
    return errorJson("VALIDATION_ERROR", error.message, meta, 400);
  }
  if ([
    "CLASSIFICATION_IDEMPOTENCY_CONFLICT",
    "CLASSIFICATION_UNDO_ALREADY_APPLIED",
    "SUBCATEGORY_UNDO_NAME_CONFLICT",
  ].includes(error.code)) {
    return errorJson("CONFLICT", error.message, meta, 409);
  }
  return errorJson("CORE_REJECTED", error.message, meta, 422);
}
