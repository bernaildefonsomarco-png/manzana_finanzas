import type { ClassificationCatalog } from "@/data/repositories/classification.repository";
import type { RelatedPerson, Tag, UserSubcategory } from "@/shared/types/domain";
import { ApiClientError, type ApiResponse } from "./movements-api";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status, payload.meta?.trace_id ?? null, payload.error.details ?? {});
  }
  return payload.data;
}

export function getClassificationCatalog(): Promise<ClassificationCatalog> {
  return request<ClassificationCatalog>("/api/v1/classification/catalog");
}

export async function createSubcategory(categoryId: string, label: string): Promise<UserSubcategory> {
  const data = await request<{ subcategory: UserSubcategory }>("/api/v1/subcategories", {
    method: "POST",
    body: JSON.stringify({ category_id: categoryId, label }),
  });
  return data.subcategory;
}

export async function createTag(label: string): Promise<Tag> {
  const data = await request<{ tag: Tag }>("/api/v1/tags", { method: "POST", body: JSON.stringify({ label }) });
  return data.tag;
}

export async function createRelatedPerson(displayName: string): Promise<RelatedPerson> {
  const data = await request<{ related_person: RelatedPerson }>("/api/v1/related-persons", {
    method: "POST",
    body: JSON.stringify({ display_name: displayName, kind: "person", relationship_label: null }),
  });
  return data.related_person;
}

