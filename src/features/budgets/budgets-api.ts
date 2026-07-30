import {
  clientIdempotencyKey,
  parseApiResponse,
} from "@/shared/api/http-client";
import type { BudgetPeriodKind } from "@/core/budgets";
import type { Box } from "@/shared/types/domain";
import type {
  BudgetCreatePayload,
  BudgetDetailView,
  BudgetSuggestionView,
  BudgetUpdatePayload,
  BudgetView,
  GoalCreatePayload,
  GoalView,
} from "./budgets-types";

export async function listBudgets(
  periodKind: BudgetPeriodKind = "mensual",
  date?: string
) {
  const query = new URLSearchParams({
    period_kind: periodKind,
    limit: "100",
  });
  if (date) query.set("date", date);
  return requestJson<{ budgets: BudgetView[]; timezone: string }>(
    `/api/v1/budgets?${query.toString()}`
  );
}

export async function getBudget(id: string) {
  const result = await requestJson<{ budget: BudgetDetailView }>(
    `/api/v1/budgets/${id}`
  );
  return result.budget;
}

export async function createBudget(payload: BudgetCreatePayload) {
  const result = await requestJson<{ budget: BudgetView }>(
    "/api/v1/budgets",
    {
      method: "POST",
      headers: writeHeaders("budget-create"),
      body: JSON.stringify(payload),
    }
  );
  return result.budget;
}

export async function updateBudget(
  id: string,
  payload: BudgetUpdatePayload
) {
  const result = await requestJson<{ budget: BudgetView }>(
    `/api/v1/budgets/${id}`,
    {
      method: "PATCH",
      headers: writeHeaders("budget-update"),
      body: JSON.stringify(payload),
    }
  );
  return result.budget;
}

export async function copyPreviousBudgets(
  periodKind: BudgetPeriodKind,
  date?: string
) {
  const result = await requestJson<{ budgets: BudgetView[] }>(
    "/api/v1/budgets/copy-previous",
    {
      method: "POST",
      headers: writeHeaders("budget-copy-previous"),
      body: JSON.stringify({
        period_kind: periodKind,
        ...(date ? { date } : {}),
      }),
    }
  );
  return result.budgets;
}

export async function budgetAction(
  id: string,
  action: "pause" | "resume" | "restore"
) {
  const result = await requestJson<{ budget: BudgetView }>(
    `/api/v1/budgets/${id}/${action}`,
    {
      method: "POST",
      headers: writeHeaders(`budget-${action}`),
      body: "{}",
    }
  );
  return result.budget;
}

export async function archiveBudget(id: string) {
  const result = await requestJson<{ budget: BudgetView }>(
    `/api/v1/budgets/${id}`,
    {
      method: "DELETE",
      headers: writeHeaders("budget-archive"),
    }
  );
  return result.budget;
}

export async function listBudgetSuggestions(
  periodKind: BudgetPeriodKind = "mensual"
) {
  return requestJson<{ suggestions: BudgetSuggestionView[] }>(
    `/api/v1/budgets/suggestions?period_kind=${encodeURIComponent(periodKind)}`
  );
}

export async function resolveBudgetSuggestion(
  id: string,
  action: "accept" | "dismiss"
) {
  return requestJson<{ budget: BudgetView | null }>(
    `/api/v1/budgets/suggestions/${encodeURIComponent(id)}/${action}`,
    {
      method: "POST",
      headers: writeHeaders(`budget-suggestion-${action}`),
      body: "{}",
    }
  );
}

export async function listGoals() {
  return requestJson<{ goals: GoalView[] }>("/api/v1/goals?limit=100");
}

export async function getGoal(id: string) {
  const result = await requestJson<{ goal: GoalView }>(
    `/api/v1/goals/${id}`
  );
  return result.goal;
}

export async function createGoal(payload: GoalCreatePayload) {
  const result = await requestJson<{ goal: GoalView }>("/api/v1/goals", {
    method: "POST",
    headers: writeHeaders("goal-create"),
    body: JSON.stringify(payload),
  });
  return result.goal;
}

export async function listGoalBoxes() {
  const result = await requestJson<{ boxes: Box[] }>(
    "/api/v1/boxes?limit=100"
  );
  return result.boxes.filter(
    (box) => box.type === "objetivo" && box.deleted_at === null
  );
}

export async function linkGoalBox(id: string, boxId: string) {
  const result = await requestJson<{ goal: GoalView }>(
    `/api/v1/goals/${id}/link-box`,
    {
      method: "POST",
      headers: writeHeaders("goal-link-box"),
      body: JSON.stringify({ box_id: boxId }),
    }
  );
  return result.goal;
}

export async function goalAction(
  id: string,
  action: "pause" | "resume" | "restore" | "unlink-box"
) {
  const result = await requestJson<{ goal: GoalView }>(
    `/api/v1/goals/${id}/${action}`,
    {
      method: "POST",
      headers: writeHeaders(`goal-${action}`),
      body: "{}",
    }
  );
  return result.goal;
}

export async function archiveGoal(id: string) {
  const result = await requestJson<{ goal: GoalView }>(
    `/api/v1/goals/${id}`,
    {
      method: "DELETE",
      headers: writeHeaders("goal-archive"),
    }
  );
  return result.goal;
}

function writeHeaders(action: string): HeadersInit {
  return {
    "content-type": "application/json",
    "idempotency-key": clientIdempotencyKey(action),
  };
}

async function requestJson<T>(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
  });
  return parseApiResponse<T>(response);
}
