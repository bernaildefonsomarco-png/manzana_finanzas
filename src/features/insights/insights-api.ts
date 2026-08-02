import { ApiClientError } from "@/features/movements/movements-api";
import type { InsightType } from "@/shared/types/domain";
import type { InsightDetail, InsightEvidence, PublicInsight } from "./insights-types";

type ApiResponse<T> =
  | { ok: true; data: T; meta: { trace_id: string; idempotent_replay?: boolean } }
  | { ok: false; error: { code: string; message: string; details?: Record<string, unknown> }; meta: { trace_id: string } };

export async function listInsights(includeExpired = false): Promise<PublicInsight[]> {
  const data = await request<{ insights: PublicInsight[] }>(
    `/api/v1/insights?limit=5&include_expired=${includeExpired}`,
  );
  return data.insights;
}

export function getInsightDetail(id: string): Promise<InsightDetail> {
  return request<InsightDetail>(`/api/v1/insights/${id}`);
}

export async function getInsightEvidence(id: string): Promise<InsightEvidence> {
  const data = await request<{ evidence: InsightEvidence }>(`/api/v1/insights/${id}/evidence`);
  return data.evidence;
}

export async function interactWithInsight(
  id: string,
  operation: "seen" | "dismiss" | "feedback" | "action",
  body?: Record<string, unknown>,
): Promise<PublicInsight> {
  const data = await request<{ insight: PublicInsight }>(
    `/api/v1/insights/${id}/${operation}`,
    writeInit(body),
  );
  return data.insight;
}

export async function setInsightTypeMuted(
  type: InsightType,
  muted: boolean,
): Promise<void> {
  await request(`/api/v1/insights/types/${type}/${muted ? "mute" : "unmute"}`, writeInit());
}

function writeInit(body?: Record<string, unknown>): RequestInit {
  return {
    method: "POST",
    headers: {
      "Idempotency-Key": crypto.randomUUID(),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  const payload = await response.json() as ApiResponse<T>;
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
