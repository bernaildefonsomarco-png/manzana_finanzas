import type { ApiResponse } from "@/features/movements/movements-api";
import { ApiClientError } from "@/features/movements/movements-api";
import type { HomeDashboardSummary } from "./home-types";

export async function getHomeDashboard(): Promise<HomeDashboardSummary> {
  const response = await fetch("/api/v1/dashboard/home", {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<HomeDashboardSummary>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data;
}

export async function dismissHomeNudge(nudgeId: string): Promise<void> {
  const response = await fetch(`/api/v1/nudges/${nudgeId}/dismiss`, {
    method: "POST",
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<{
    nudge_candidate: unknown;
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }
}
