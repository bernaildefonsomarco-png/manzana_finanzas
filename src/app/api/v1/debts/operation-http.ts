import {
  errorJson,
  type ApiMeta,
} from "@/app/api/_lib/http";
import { DebtOperationError } from "@/data/repositories/debts.repository";

export function debtOperationErrorJson(
  error: DebtOperationError,
  meta: ApiMeta
) {
  if (error.code === "DEBT_OPERATION_NOT_FOUND") {
    return errorJson("NOT_FOUND", error.message, meta, 404);
  }
  if (error.code === "DEBT_OPERATION_CONFLICT") {
    return errorJson("CONFLICT", error.message, meta, 409);
  }
  return errorJson("VALIDATION_ERROR", error.message, meta, 400);
}
