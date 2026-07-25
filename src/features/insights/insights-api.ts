import { ApiClientError } from "@/features/movements/movements-api";
import type { InsightCandidate } from "@/shared/types/domain";
import type {
  InsightDetail,
  InsightEvidence,
} from "./insights-types";

type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      meta: { trace_id: string };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      meta: { trace_id: string };
    };

export async function listInsights(): Promise<InsightCandidate[]> {
  const data = await request<{ insights: InsightCandidate[] }>(
    "/api/v1/insights?limit=50",
  );
  return data.insights;
}

export function getInsightDetail(id: string): Promise<InsightDetail> {
  return request<InsightDetail>(`/api/v1/insights/${id}`);
}

export async function getInsightEvidence(id: string): Promise<InsightEvidence> {
  const data = await request<{ evidence: InsightEvidence }>(
    `/api/v1/insights/${id}/evidence`,
  );
  return data.evidence;
}

export async function markInsightSeen(id: string): Promise<InsightCandidate> {
  const data = await request<{ insight: InsightCandidate }>(
    `/api/v1/insights/${id}/seen`,
    { method: "POST" },
  );
  return data.insight;
}

export async function dismissInsight(
  id: string,
  reason: string,
): Promise<InsightCandidate> {
  const data = await request<{ insight: InsightCandidate }>(
    `/api/v1/insights/${id}/dismiss`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason }),
    },
  );
  return data.insight;
}

export async function recordInsightAction(
  id: string,
  actionKey: string,
  metadata: Record<string, unknown> = {},
): Promise<InsightCandidate> {
  const data = await request<{ insight: InsightCandidate; note: string }>(
    `/api/v1/insights/${id}/action`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action_key: actionKey, metadata }),
    },
  );
  return data.insight;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...init,
  });
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
