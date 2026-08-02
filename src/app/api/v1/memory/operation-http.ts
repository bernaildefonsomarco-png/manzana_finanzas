import type { ApiMeta } from "@/app/api/_lib/http";
import { errorJson } from "@/app/api/_lib/http";
import { MemoryRepositoryError } from "@/data/repositories/memory.repository";

export function memoryOperationError(error: MemoryRepositoryError, meta: ApiMeta) {
  if (error.code === "NOT_FOUND") return errorJson("NOT_FOUND", error.message, meta, 404);
  if (error.code === "CONFLICT") return errorJson("CONFLICT", error.message, meta, 409);
  return errorJson("CORE_REJECTED", error.message, meta, 422);
}

export function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
