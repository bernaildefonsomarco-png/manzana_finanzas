import { moneyToCents, requirePositiveMoney } from "./money";
import type { BudgetKind } from "./types";

export const BUDGET_THRESHOLDS: Record<BudgetKind, readonly number[]> = {
  presupuesto: [100],
  limite_blando: [90, 100],
  limite_duro: [70, 90, 100],
};

export function advanceBudgetThresholds(input: {
  kind: BudgetKind;
  amount: number;
  spent: number;
  alerted_thresholds: readonly number[];
}): {
  crossed_thresholds: number[];
  alerted_thresholds: number[];
} {
  const amountCents = requirePositiveMoney(input.amount, "presupuesto");
  const spentCents = moneyToCents(input.spent, "gastado");
  const alreadyAlerted = new Set(input.alerted_thresholds);
  const crossed = BUDGET_THRESHOLDS[input.kind].filter(
    (threshold) =>
      spentCents * 100 >= amountCents * threshold &&
      !alreadyAlerted.has(threshold)
  );

  return {
    crossed_thresholds: crossed,
    alerted_thresholds: [
      ...new Set([...input.alerted_thresholds, ...crossed]),
    ].sort((left, right) => left - right),
  };
}

export function resetBudgetThresholdsForRenewal(): [] {
  return [];
}
