import type { RecurringRule } from "@/shared/types/domain";
import { ApiClientError, parseApiResponse } from "./http-client";

export { ApiClientError };

/** Selector de regla recurrente para `pago_recurrente` (`26` §4.3). */
export async function listRecurringRules(): Promise<RecurringRule[]> {
  const response = await fetch("/api/v1/recurring", { credentials: "same-origin" });
  const data = await parseApiResponse<{ rules: RecurringRule[] }>(response);
  return data.rules;
}
