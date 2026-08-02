import type { ApiMeta } from "@/app/api/_lib/http";
import { errorJson } from "@/app/api/_lib/http";
import { ReminderRepositoryError } from "@/data/repositories/reminders.repository";

export function reminderOperationError(error: ReminderRepositoryError, meta: ApiMeta) {
  if (error.code === "NOT_FOUND") return errorJson("NOT_FOUND", error.message, meta, 404);
  if (error.code === "CONFLICT") return errorJson("CONFLICT", error.message, meta, 409);
  if (error.code === "FORBIDDEN") return errorJson("NOT_FOUND", "Ese recordatorio ya no está.", meta, 404);
  return errorJson("VALIDATION_ERROR", error.message, meta, 400);
}

export function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
