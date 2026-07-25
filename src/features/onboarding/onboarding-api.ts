import type { InitialOnboardingSummary } from "@/core/onboarding/onboarding-activation";
import type { OnboardingTransition } from "@/data/repositories/onboarding.repository";
import {
  ApiClientError,
  type ApiResponse,
} from "@/features/movements/movements-api";

type StartOnboardingResponse = {
  transition: OnboardingTransition;
  onboarding: InitialOnboardingSummary;
};

export async function startDashboardOnboarding(): Promise<StartOnboardingResponse> {
  const response = await fetch("/api/v1/onboarding", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "start",
      source: "dashboard_home",
    }),
  });
  const payload = (await response.json()) as ApiResponse<StartOnboardingResponse>;

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
