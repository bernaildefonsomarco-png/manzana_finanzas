import {
  clientIdempotencyKey,
  parseApiResponse,
} from "@/shared/api/http-client";
import type { RecurringRule } from "@/shared/types/domain";
import type {
  ConfirmRecurringCandidatePayload,
  CreateRecurringPayload,
  MarkRecurringPaidPayload,
  MarkRecurringPaidResponse,
  RecurringAccountsResponse,
  RecurringOccurrencesResponse,
  RecurringRuleWithOccurrences,
  UpcomingApiResponse,
  UpdateRecurringPayload,
} from "./upcoming-types";

export async function listUpcomingPayments(): Promise<UpcomingApiResponse> {
  return requestJson<UpcomingApiResponse>("/api/v1/upcoming");
}

export async function listRecurringAccounts(): Promise<RecurringAccountsResponse> {
  return requestJson<RecurringAccountsResponse>("/api/v1/accounts");
}

export async function listRecurringOccurrences(
  ruleId: string
): Promise<RecurringOccurrencesResponse> {
  return requestJson<RecurringOccurrencesResponse>(
    `/api/v1/recurring/${ruleId}/occurrences?limit=100`
  );
}

export async function getRecurringRule(
  ruleId: string
): Promise<RecurringRuleWithOccurrences> {
  const data = await requestJson<{
    recurring_rule: Omit<RecurringRuleWithOccurrences, "occurrences">;
  }>(`/api/v1/recurring/${ruleId}`);
  return { ...data.recurring_rule, occurrences: [] };
}

export async function createRecurringRule(
  payload: CreateRecurringPayload,
  idempotencyKey = clientIdempotencyKey("dashboard-recurring-create")
): Promise<RecurringRule> {
  const data = await requestJson<{
    recurring_rule: RecurringRule;
  }>("/api/v1/recurring", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });
  return data.recurring_rule;
}

export async function updateRecurringRule(
  ruleId: string,
  payload: UpdateRecurringPayload
): Promise<RecurringRule> {
  const data = await requestJson<{
    recurring_rule: RecurringRule;
  }>(`/api/v1/recurring/${ruleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return data.recurring_rule;
}

export async function pauseRecurringRule(ruleId: string) {
  return requestJson<{
    recurring_rule: RecurringRuleWithOccurrences;
    idempotent: boolean;
  }>(`/api/v1/recurring/${ruleId}/pause`, { method: "POST" });
}

export async function resumeRecurringRule(ruleId: string) {
  return requestJson<{
    recurring_rule: RecurringRuleWithOccurrences;
    idempotent: boolean;
  }>(`/api/v1/recurring/${ruleId}/resume`, { method: "POST" });
}

export async function cancelRecurringRule(ruleId: string) {
  return requestJson<{ recurring_rule: RecurringRuleWithOccurrences }>(
    `/api/v1/recurring/${ruleId}/cancel`,
    { method: "POST" }
  );
}

export async function skipRecurringOccurrence(
  ruleId: string,
  occurrenceId: string
) {
  return requestJson<{
    occurrence: RecurringOccurrencesResponse["occurrences"][number];
    idempotent: boolean;
  }>(
    `/api/v1/recurring/${ruleId}/occurrences/${occurrenceId}/skip`,
    { method: "POST" }
  );
}

export async function markRecurringPaid(
  ruleId: string,
  occurrenceId: string,
  payload: MarkRecurringPaidPayload,
  idempotencyKey: string
): Promise<MarkRecurringPaidResponse> {
  return requestJson<MarkRecurringPaidResponse>(
    `/api/v1/recurring/${ruleId}/occurrences/${occurrenceId}/mark-paid`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    }
  );
}

export async function confirmRecurringCandidate(
  candidateId: string,
  payload: ConfirmRecurringCandidatePayload = {}
): Promise<{
  candidate: UpcomingApiResponse["candidates"][number];
  recurring_rule: RecurringRule;
}> {
  return requestJson<{
    candidate: UpcomingApiResponse["candidates"][number];
    recurring_rule: RecurringRule;
  }>(
    `/api/v1/recurring/candidates/${candidateId}/confirm`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );
}

export async function discardRecurringCandidate(candidateId: string) {
  return requestJson<{ candidate: UpcomingApiResponse["candidates"][number] }>(
    `/api/v1/recurring/candidates/${candidateId}/discard`,
    { method: "POST" }
  );
}

async function requestJson<T>(
  input: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
  });
  return parseApiResponse<T>(response);
}
