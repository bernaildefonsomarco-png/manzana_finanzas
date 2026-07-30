import {
  centsToMoney,
  requireNonNegativeMoney,
  requirePositiveMoney,
} from "./money";
import { requireValidIsoDate } from "./periods";

export function calculateGoalMonthlyPace(input: {
  target_amount: number;
  current_balance: number;
  target_date: string | null;
  as_of: string;
}): number | null {
  requireValidIsoDate(input.as_of);
  if (!input.target_date) return null;
  const target = requireValidIsoDate(input.target_date);
  const asOf = requireValidIsoDate(input.as_of);
  if (input.target_date <= input.as_of) return null;

  const targetCents = requirePositiveMoney(input.target_amount, "objetivo");
  const balanceCents = requireNonNegativeMoney(
    input.current_balance,
    "saldo"
  );
  const remainingCents = Math.max(targetCents - balanceCents, 0);
  const calendarMonthDifference =
    (target.year - asOf.year) * 12 + target.month - asOf.month;
  const monthsRemaining = Math.max(calendarMonthDifference, 1);

  return centsToMoney(Math.ceil(remainingCents / monthsRemaining));
}
