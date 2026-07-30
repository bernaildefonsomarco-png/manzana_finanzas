import {
  centsToMoney,
  requireNonNegativeMoney,
  requirePositiveMoney,
} from "./money";

export type RenewedBudgetAmounts = {
  base_amount: number;
  rollover_amount: number;
  amount: number;
  alerted_thresholds: [];
};

export function calculateRenewedBudgetAmounts(input: {
  base_amount: number;
  rollover_amount: number;
  spent: number;
  rollover: boolean;
  auto_renew?: boolean;
}): RenewedBudgetAmounts | null {
  if (input.auto_renew === false) return null;

  const baseCents = requirePositiveMoney(input.base_amount, "monto base");
  const oldRolloverCents = requireNonNegativeMoney(
    input.rollover_amount,
    "acarreo"
  );
  const spentCents = requireNonNegativeMoney(input.spent, "gastado");

  const spentFromBase = Math.max(spentCents - oldRolloverCents, 0);
  const nextRolloverCents = input.rollover
    ? Math.max(baseCents - spentFromBase, 0)
    : 0;

  return {
    base_amount: centsToMoney(baseCents),
    rollover_amount: centsToMoney(nextRolloverCents),
    amount: centsToMoney(baseCents + nextRolloverCents),
    alerted_thresholds: [],
  };
}
