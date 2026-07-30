import type { CategoryId } from "@/shared/types/domain";
import { centsToMoney, moneyToCents } from "./money";
import { requireValidIsoDate } from "./periods";
import type { BudgetPeriodKind } from "./types";

export type BudgetSuggestionEvidence = {
  period_start: string;
  period_end: string;
  spent: number;
};

export type BudgetSuggestion = {
  id: string;
  category_id: CategoryId | null;
  period_kind: BudgetPeriodKind;
  proposed_amount: number;
  evidence: BudgetSuggestionEvidence[];
  evidence_from: string;
  evidence_to: string;
};

export function medianMoney(values: number[]): number {
  if (values.length === 0) {
    throw new Error("La mediana necesita al menos una muestra.");
  }
  const cents = values
    .map((value) => moneyToCents(value, "muestra"))
    .sort((left, right) => left - right);
  const middle = Math.floor(cents.length / 2);
  const medianCents =
    cents.length % 2 === 1
      ? cents[middle]
      : Math.round((cents[middle - 1] + cents[middle]) / 2);
  return centsToMoney(medianCents);
}

export function buildBudgetSuggestion(input: {
  category_id: CategoryId | null;
  period_kind: BudgetPeriodKind;
  as_of: string;
  periods: BudgetSuggestionEvidence[];
}): BudgetSuggestion | null {
  requireValidIsoDate(input.as_of);
  const evidence = input.periods
    .map((period) => {
      requireValidIsoDate(period.period_start);
      requireValidIsoDate(period.period_end);
      return period;
    })
    .filter(
      (period) => period.period_end < input.as_of && period.spent > 0
    )
    .sort(
      (left, right) =>
        right.period_end.localeCompare(left.period_end) ||
        right.period_start.localeCompare(left.period_start)
    )
    .slice(0, 6)
    .reverse();

  if (evidence.length < 2) return null;

  const first = evidence[0];
  const last = evidence[evidence.length - 1];
  return {
    id: buildBudgetSuggestionKey({
      category_id: input.category_id,
      period_kind: input.period_kind,
      evidence_from: first.period_start,
      evidence_to: last.period_end,
    }),
    category_id: input.category_id,
    period_kind: input.period_kind,
    proposed_amount: medianMoney(evidence.map((period) => period.spent)),
    evidence,
    evidence_from: first.period_start,
    evidence_to: last.period_end,
  };
}

export function buildBudgetSuggestionKey(input: {
  category_id: CategoryId | null;
  period_kind: BudgetPeriodKind;
  evidence_from: string;
  evidence_to: string;
}): string {
  return [
    "bs",
    input.category_id ?? "general",
    input.period_kind,
    input.evidence_from,
    input.evidence_to,
  ].join("_");
}
