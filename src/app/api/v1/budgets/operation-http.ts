import type { ApiMeta } from "@/app/api/_lib/http";
import { errorJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { BudgetOperationError } from "@/data/repositories/budgets.repository";

export function budgetOperationErrorJson(
  error: BudgetOperationError,
  meta: ApiMeta
) {
  if (error.code === "BUDGET_NOT_FOUND" || error.code === "GOAL_NOT_FOUND") {
    return errorJson("NOT_FOUND", error.message, meta, 404);
  }
  if (
    error.code === "BUDGET_CONFLICT" ||
    error.code === "GOAL_CONFLICT" ||
    error.code === "IDEMPOTENCY_CONFLICT"
  ) {
    return errorJson("CONFLICT", error.message, meta, 409);
  }
  return errorJson("VALIDATION_ERROR", error.message, meta, 400);
}

export function budgetRouteError(error: unknown, meta: ApiMeta) {
  if (error instanceof BudgetOperationError) {
    return budgetOperationErrorJson(error, meta);
  }
  if (isZodLike(error)) return validationError(error, meta);
  return unexpectedError(error, meta);
}

export function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
