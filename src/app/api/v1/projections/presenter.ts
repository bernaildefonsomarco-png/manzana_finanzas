import type {
  ExpenseSimulation,
  MonthlySituation,
  PeriodProjection,
} from "@/core/projections";
import type { ProjectionBreakdown } from "@/data/repositories/projections.repository";

export function presentPeriodProjection(
  projection: PeriodProjection,
  hasPenAccounts: boolean
) {
  const available = hasPenAccounts && projection.sufficient_data;
  return {
    available,
    reason: !hasPenAccounts
      ? "no_balance_data"
      : projection.sufficient_data
        ? null
        : projection.insufficiency_reason,
    currency: projection.currency,
    period_start: projection.period_start,
    period_end: projection.period_end,
    as_of: projection.as_of,
    projection:
      available && projection.projection_cents !== null
        ? money(projection.projection_cents)
        : null,
    range:
      available && projection.range
        ? {
            min: money(projection.range.min_cents),
            max: money(projection.range.max_cents),
          }
        : null,
    free_money: money(projection.free_money_cents),
    daily_pace: money(projection.daily_pace_cents),
    observed_days: projection.observed_days,
    days_remaining: projection.days_remaining,
    assumptions: projection.assumptions.map((assumption) => {
      if ("amount_cents" in assumption) {
        return {
          ...assumption,
          amount: money(assumption.amount_cents),
          amount_cents: undefined,
        };
      }
      return assumption;
    }),
  };
}

export function presentProjectionBreakdown(
  breakdown: ProjectionBreakdown,
  projection: PeriodProjection,
  hasPenAccounts: boolean
) {
  return {
    available: hasPenAccounts && projection.sufficient_data,
    currency: breakdown.currency,
    period_start: projection.period_start,
    period_end: projection.period_end,
    lines: breakdown.lines.map((line) => ({
      ...line,
      amount:
        line.amount_cents === null ? null : money(line.amount_cents),
      amount_cents: undefined,
    })),
  };
}

export function presentMonthlySituation(situation: MonthlySituation) {
  return {
    currency: situation.currency,
    period_start: situation.period_start,
    period_end: situation.period_end,
    as_of: situation.as_of,
    coverage: {
      ...situation.coverage,
      uncovered: money(situation.coverage.uncovered_cents),
      uncovered_cents: undefined,
    },
    spending_income: {
      ...situation.spending_income,
      spending: money(situation.spending_income.spending_cents),
      income: money(situation.spending_income.income_cents),
      ratio_percent:
        situation.spending_income.ratio_basis_points === null
          ? null
          : situation.spending_income.ratio_basis_points / 100,
      spending_cents: undefined,
      income_cents: undefined,
      ratio_basis_points: undefined,
    },
    reserve: {
      ...situation.reserve,
      total: money(situation.reserve.total_cents),
      total_cents: undefined,
    },
    debts: situation.debts,
    summary_facts: situation.summary_facts,
  };
}

export function presentExpenseSimulation(simulation: ExpenseSimulation) {
  return {
    currency: simulation.currency,
    parts: simulation.parts.map((part) => {
      if (part.kind === "immediate_effect") {
        return {
          kind: part.kind,
          free_money_before: money(part.free_money_before_cents),
          simulated_amount: money(part.simulated_amount_cents),
          free_money_after: money(part.free_money_after_cents),
        };
      }
      if (part.kind === "already_counted") {
        return {
          kind: part.kind,
          uncovered_commitments: money(
            part.uncovered_commitments_cents
          ),
          refs: part.refs,
        };
      }
      return {
        kind: part.kind,
        available: part.available,
        projection:
          part.projection_cents === null
            ? null
            : money(part.projection_cents),
        range: part.range
          ? {
              min: money(part.range.min_cents),
              max: money(part.range.max_cents),
            }
          : null,
        assumptions: part.assumptions.map((assumption) =>
          "amount_cents" in assumption
            ? {
                ...assumption,
                amount: money(assumption.amount_cents),
                amount_cents: undefined,
              }
            : assumption
        ),
      };
    }),
  };
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}
