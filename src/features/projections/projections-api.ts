import { parseApiResponse } from "@/shared/api/http-client";
import type {
  ExpenseSimulationView,
  MonthlySituationView,
  PeriodProjectionView,
  ProjectionBreakdownView,
} from "./projections-types";

export async function getPeriodProjection() {
  const data = await requestJson<{ projection: PeriodProjectionView }>(
    "/api/v1/projections/period"
  );
  return data.projection;
}

export async function getProjectionBreakdown() {
  const data = await requestJson<{ breakdown: ProjectionBreakdownView }>(
    "/api/v1/projections/period/breakdown"
  );
  return data.breakdown;
}

export async function getMonthlySituation() {
  const data = await requestJson<{ situation: MonthlySituationView }>(
    "/api/v1/projections/health"
  );
  return data.situation;
}

export async function simulateExpense(payload: {
  amount: number;
  category_id?: string | null;
  date?: string;
}) {
  return requestJson<{
    available: boolean;
    reason: string | null;
    simulation: ExpenseSimulationView;
    budget_effect: {
      category_id: string;
      simulated_amount: number;
    } | null;
  }>("/api/v1/simulate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function requestJson<T>(input: string, init: RequestInit = {}) {
  const response = await fetch(input, {
    credentials: "same-origin",
    ...init,
  });
  return parseApiResponse<T>(response);
}
