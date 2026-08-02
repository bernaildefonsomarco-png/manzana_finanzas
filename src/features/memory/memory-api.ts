import { ApiClientError } from "@/features/movements/movements-api";
import type {
  MemoryEvent,
  MemoryGroups,
  MemoryItem,
  MemoryScope,
  ProfileCandidate,
} from "./memory-types";

type ApiResponse<T> =
  | { ok: true; data: T; meta: { trace_id: string; idempotent_replay?: boolean } }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> }; meta: { trace_id: string } };

export function listMemory(includeInactive: boolean, scope?: MemoryScope): Promise<MemoryGroups> {
  const query = new URLSearchParams({ include_inactive: String(includeInactive) });
  if (scope) query.set("scope", scope);
  return request(`/api/v1/memory?${query.toString()}`);
}

export async function listProfileCandidates(): Promise<ProfileCandidate[]> {
  return (await request<{ candidates: ProfileCandidate[] }>("/api/v1/memory/candidates")).candidates;
}

export function getMemoryDetail(id: string): Promise<{ memory: MemoryItem; events: MemoryEvent[] }> {
  return request(`/api/v1/memory/${id}`);
}

export async function correctMemory(
  item: MemoryItem,
  replacement: string,
): Promise<{ memory: MemoryItem; replacement: MemoryItem | null }> {
  return request(`/api/v1/memory/${item.id}`, writeInit("PATCH", {
    scope: item.scope,
    ...(item.scope === "preference" ? { value: replacement } : { statement: replacement }),
  }));
}

export async function markMemoryViewed(item: MemoryItem): Promise<void> {
  await request(`/api/v1/memory/${item.id}/view`, writeInit("POST", { scope: item.scope }));
}

export async function forgetMemory(item: MemoryItem): Promise<void> {
  await request(`/api/v1/memory/${item.id}`, writeInit("DELETE", { scope: item.scope }));
}

export async function undoMemory(item: MemoryItem): Promise<void> {
  await request(`/api/v1/memory/${item.id}/undo`, writeInit("POST", { scope: item.scope }));
}

export async function reactivateMemory(item: MemoryItem): Promise<void> {
  await request(`/api/v1/memory/${item.id}/reactivate`, writeInit("POST", { scope: item.scope }));
}

export async function resolveCandidate(
  candidate: ProfileCandidate,
  action: "confirm" | "reject" | "never-ask",
  statement?: string,
): Promise<void> {
  await request(
    `/api/v1/memory/candidates/${candidate.id}/${action}`,
    writeInit("POST", statement ? { statement } : {}),
  );
}

export async function forgetAllMemory(confirmation: string): Promise<void> {
  await request("/api/v1/memory", writeInit("DELETE", { confirmation }));
}

function writeInit(method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify(body),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
      payload.error.details ?? {},
    );
  }
  return payload.data;
}
