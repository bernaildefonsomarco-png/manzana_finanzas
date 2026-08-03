import type { PendingItem } from "@/shared/types/domain";
import { clientIdempotencyKey, parseApiResponse } from "@/shared/api/http-client";
import type {
  AssistantHealth,
  AssistantMessageWithBlocks,
  AssistantThread,
} from "./assistant-types";

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  return parseApiResponse<T>(response);
}

export async function listAssistantThreads(status?: "activo" | "archivado"): Promise<AssistantThread[]> {
  const query = status ? `?status=${status}&limit=50` : "?limit=50";
  const data = await request<{ threads: AssistantThread[] }>(`/api/v1/assistant/threads${query}`);
  return data.threads;
}

export async function getAssistantThread(
  threadId: string
): Promise<{ thread: AssistantThread; messages: AssistantMessageWithBlocks[] }> {
  return request(`/api/v1/assistant/threads/${threadId}?limit=100`);
}

export async function archiveAssistantThread(threadId: string): Promise<AssistantThread> {
  const data = await request<{ thread: AssistantThread }>(
    `/api/v1/assistant/threads/${threadId}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "archivado" }),
    }
  );
  return data.thread;
}

export async function postAssistantTurn(input: {
  threadId: string | null;
  text: string;
}): Promise<{ thread_id: string; external_event_id: string; messages: AssistantMessageWithBlocks[] }> {
  return request("/api/v1/assistant/turns", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": clientIdempotencyKey("asistente.turno"),
    },
    body: JSON.stringify({ thread_id: input.threadId, text: input.text }),
  });
}

/** Catalogo minimo para resolver `category_id` a un nombre en las tarjetas (`ConfirmationCardField`). */
export async function listAssistantCategories(): Promise<Array<{ id: string; name: string }>> {
  const data = await request<{ categories: Array<{ id: string; name: string }> }>(
    "/api/v1/categories?limit=100"
  );
  return data.categories;
}

export async function getAssistantHealth(): Promise<AssistantHealth> {
  return request("/api/v1/assistant/health", { cache: "no-store" });
}

/** Lee un pending item por id — misma lectura que usa el resto de la app, sin ruta propia (`WEB-D263`). */
export async function getAssistantProposal(pendingItemId: string): Promise<PendingItem> {
  const data = await request<{ pending_item: PendingItem }>(`/api/v1/pending/${pendingItemId}`);
  return data.pending_item;
}

export async function confirmAssistantProposal(
  pendingItemId: string,
  options: { confirmDuplicate?: boolean } = {}
): Promise<{ proposal: PendingItem; idempotent: boolean }> {
  return request(`/api/v1/assistant/proposals/${pendingItemId}/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": clientIdempotencyKey("asistente.confirmar"),
    },
    body: JSON.stringify({ confirm_duplicate: options.confirmDuplicate ?? false }),
  });
}

export async function dismissAssistantProposal(
  pendingItemId: string,
  reason = "asistente_descartada"
): Promise<{ proposal: PendingItem }> {
  return request(`/api/v1/assistant/proposals/${pendingItemId}/dismiss`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

export async function editAssistantProposal(
  pendingItemId: string,
  normalizedSummary: Partial<PendingItem["normalized_summary"]>
): Promise<{ proposal: PendingItem }> {
  return request(`/api/v1/assistant/proposals/${pendingItemId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ normalized_summary: normalizedSummary, reason: "asistente_edicion" }),
  });
}
