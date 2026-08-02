import type { CategoryId } from "@/shared/types/domain";
import { ApiClientError } from "@/features/movements/movements-api";

type ApiResponse<T> =
  | { ok: true; data: T; meta: { trace_id: string; idempotent_replay?: boolean } }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> }; meta: { trace_id: string } };

export type BulkPreview = {
  preview: true;
  count: number;
  sample: { description?: string | null; merchant?: string | null; amount?: number } | null;
  movements: Array<{ id: string; description?: string | null; merchant?: string | null; amount?: number }>;
  excluded_count: number;
  idempotent: boolean;
};

export type ClassificationWhy = {
  movement: { id: string; category_id: string | null; subcategory_id: string | null };
  explanation: string;
  evidence: Array<{ polarity: "positive" | "negative"; text: string; observed_at: string }>;
  forget_targets: Array<{ memory_id: string; summary: string }>;
};

export async function classifyBulk(input: {
  movementIds: string[];
  excludedIds?: string[];
  categoryId: CategoryId | null;
  includeManuallyCorrected?: boolean;
  preview: boolean;
  idempotencyKey: string;
}): Promise<{ preview?: BulkPreview; batch?: { id: string; movement_count: number; undo_until: string } }> {
  return request("/api/v1/classification/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({
      movement_ids: input.movementIds,
      excluded_ids: input.excludedIds ?? [],
      category_id: input.categoryId,
      subcategory_id: null,
      include_manually_corrected: input.includeManuallyCorrected ?? false,
      preview: input.preview,
    }),
  });
}

export async function undoClassificationBatch(batchId: string): Promise<void> {
  await request(`/api/v1/classification/bulk/${batchId}/undo`, {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
}

export async function getClassificationWhy(movementId: string): Promise<ClassificationWhy> {
  return (await request<{ classification: ClassificationWhy }>(`/api/v1/movements/${movementId}/classification/why`)).classification;
}

export async function forgetClassificationMemory(memoryId: string): Promise<void> {
  await request(`/api/v1/memory/${memoryId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ scope: "classification", reason: "classification_why_forget" }),
  });
}

export async function mergeSubcategories(input: {
  sourceId: string;
  targetId: string;
  preview: boolean;
  idempotencyKey: string;
}): Promise<{ preview?: { count: number; target_count_before: number; target_count_after: number }; batch?: { id: string; movement_count: number; undo_until: string } }> {
  return request(`/api/v1/subcategories/${input.sourceId}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": input.idempotencyKey },
    body: JSON.stringify({ target_subcategory_id: input.targetId, preview: input.preview }),
  });
}

export async function undoSubcategoryMerge(sourceId: string, batchId: string): Promise<void> {
  await request(`/api/v1/subcategories/${sourceId}/merge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ undo_batch_id: batchId }),
  });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status, payload.meta?.trace_id ?? null, payload.error.details ?? {});
  }
  return payload.data;
}
