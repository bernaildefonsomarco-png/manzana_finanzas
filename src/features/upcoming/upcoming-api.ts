import type { ApiResponse } from "@/features/movements/movements-api";
import { ApiClientError } from "@/features/movements/movements-api";
import type {
  ConfirmRecurringCandidatePayload,
  ConfirmRecurringCandidateResponse,
  CreateRecurringPayload,
  DetectRecurringCandidatesPayload,
  DetectRecurringCandidatesResponse,
  DiscardRecurringCandidateResponse,
  MarkRecurringPaidPayload,
  MarkRecurringPaidResponse,
  RecurringAccountsResponse,
  RecurringRuleResponse,
  RecurringRuleWithOccurrences,
  UpcomingDashboardResponse,
  UpdateRecurringPayload,
} from "./upcoming-types";

export async function listUpcomingPayments(): Promise<UpcomingDashboardResponse> {
  const response = await fetch("/api/v1/dashboard/upcoming", {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<UpcomingDashboardResponse>;

  if (!payload.ok) {
    throw toClientError(payload, response.status);
  }

  return payload.data;
}

export async function getRecurringRule(
  ruleId: string
): Promise<RecurringRuleWithOccurrences> {
  const response = await fetch(`/api/v1/recurring/${ruleId}`, {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<RecurringRuleResponse>;

  if (!payload.ok) {
    throw toClientError(payload, response.status);
  }

  return payload.data.recurring_rule;
}

export async function createRecurringRule(
  payload: CreateRecurringPayload
): Promise<RecurringRuleWithOccurrences> {
  const response = await fetch("/api/v1/recurring", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const apiPayload = (await response.json()) as ApiResponse<{
    recurring_rule: RecurringRuleWithOccurrences;
  }>;

  if (!apiPayload.ok) {
    throw toClientError(apiPayload, response.status);
  }

  return apiPayload.data.recurring_rule;
}

export async function updateRecurringRule(
  ruleId: string,
  payload: UpdateRecurringPayload
): Promise<RecurringRuleWithOccurrences> {
  const response = await fetch(`/api/v1/recurring/${ruleId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const apiPayload = (await response.json()) as ApiResponse<{
    recurring_rule: RecurringRuleWithOccurrences;
  }>;

  if (!apiPayload.ok) {
    throw toClientError(apiPayload, response.status);
  }

  return apiPayload.data.recurring_rule;
}

export async function cancelRecurringRule(ruleId: string) {
  const response = await fetch(`/api/v1/recurring/${ruleId}/cancel`, {
    method: "POST",
    credentials: "same-origin",
  });
  const apiPayload = (await response.json()) as ApiResponse<{
    recurring_rule: RecurringRuleWithOccurrences;
  }>;

  if (!apiPayload.ok) {
    throw toClientError(apiPayload, response.status);
  }

  return apiPayload.data.recurring_rule;
}

export async function markRecurringPaid(
  ruleId: string,
  occurrenceId: string,
  payload: MarkRecurringPaidPayload
): Promise<MarkRecurringPaidResponse> {
  const response = await fetch(
    `/api/v1/recurring/${ruleId}/occurrences/${occurrenceId}/mark-paid`,
    {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": createClientIdempotencyKey(ruleId, occurrenceId),
      },
      body: JSON.stringify(payload),
    }
  );
  const apiPayload = (await response.json()) as ApiResponse<MarkRecurringPaidResponse>;

  if (!apiPayload.ok) {
    throw toClientError(apiPayload, response.status);
  }

  return apiPayload.data;
}

export async function detectRecurringCandidates(
  payload: DetectRecurringCandidatesPayload = {}
): Promise<DetectRecurringCandidatesResponse> {
  const response = await fetch("/api/v1/recurring/detect", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const apiPayload = (await response.json()) as ApiResponse<DetectRecurringCandidatesResponse>;

  if (!apiPayload.ok) {
    throw toClientError(apiPayload, response.status);
  }

  return apiPayload.data;
}

export async function confirmRecurringCandidate(
  candidateId: string,
  payload: ConfirmRecurringCandidatePayload = {}
): Promise<ConfirmRecurringCandidateResponse> {
  const response = await fetch(`/api/v1/recurring/candidates/${candidateId}/confirm`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const apiPayload = (await response.json()) as ApiResponse<ConfirmRecurringCandidateResponse>;

  if (!apiPayload.ok) {
    throw toClientError(apiPayload, response.status);
  }

  return apiPayload.data;
}

export async function discardRecurringCandidate(
  candidateId: string
): Promise<DiscardRecurringCandidateResponse> {
  const response = await fetch(`/api/v1/recurring/candidates/${candidateId}/discard`, {
    method: "POST",
    credentials: "same-origin",
  });
  const apiPayload = (await response.json()) as ApiResponse<DiscardRecurringCandidateResponse>;

  if (!apiPayload.ok) {
    throw toClientError(apiPayload, response.status);
  }

  return apiPayload.data;
}

export async function listRecurringAccounts(): Promise<RecurringAccountsResponse> {
  const response = await fetch("/api/v1/accounts", {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<RecurringAccountsResponse>;

  if (!payload.ok) {
    throw toClientError(payload, response.status);
  }

  return payload.data;
}

function createClientIdempotencyKey(ruleId: string, occurrenceId: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `dashboard-recurring-payment:${ruleId}:${occurrenceId}:${random}`;
}

function toClientError<T>(payload: ApiResponse<T>, status: number) {
  if (payload.ok) {
    return new ApiClientError("INVALID_RESPONSE", "Respuesta inesperada.", status, null);
  }

  return new ApiClientError(
    payload.error.code,
    payload.error.message,
    status,
    payload.meta?.trace_id ?? null
  );
}
