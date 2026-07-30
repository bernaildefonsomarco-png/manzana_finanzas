import type { BudgetProgressBand } from "./types";

export function selectTopBudgetSummaries<
  T extends {
    id: string;
    spent: number;
    band: BudgetProgressBand;
  },
>(budgets: readonly T[]): T[] {
  return [...budgets]
    .sort(
      (left, right) =>
        bandPriority(left.band) - bandPriority(right.band) ||
        right.spent - left.spent ||
        left.id.localeCompare(right.id)
    )
    .slice(0, 3);
}

function bandPriority(band: BudgetProgressBand): number {
  if (band === "superado") return 0;
  if (band === "cerca") return 1;
  return 2;
}
