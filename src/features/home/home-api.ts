import { ApiClientError } from "@/features/movements/movements-api";
import type { HomeBlockKind, HomeComposition, HomeNextAction } from "./home-types";

type ApiResponse<T> =
  | { ok: true; data: T; meta: { trace_id: string } }
  | { ok: false; error: { code: string; message: string }; meta: { trace_id: string } };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const payload = (await response.json()) as ApiResponse<T>;
  if (!payload.ok) {
    throw new ApiClientError(payload.error.code, payload.error.message, response.status, payload.meta?.trace_id ?? null, {});
  }
  return payload.data;
}

export async function getHome(): Promise<HomeComposition> {
  return request<HomeComposition>("/api/v1/home");
}

export async function getHomeNextAction(): Promise<HomeNextAction | null> {
  const data = await request<{ next_action: HomeNextAction | null }>("/api/v1/home/next");
  return data.next_action;
}

export async function postponeNextAction(id: string): Promise<void> {
  await request(`/api/v1/home/next/${id}/postpone`, { method: "POST" });
}

export async function setHomeBlockHidden(block: HomeBlockKind, hidden: boolean): Promise<HomeBlockKind[]> {
  const data = await request<{ hidden_blocks: HomeBlockKind[] }>("/api/v1/home/preferences", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
    body: JSON.stringify({ block, hidden }),
  });
  return data.hidden_blocks;
}
