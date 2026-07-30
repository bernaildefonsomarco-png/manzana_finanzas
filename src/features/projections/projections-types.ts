export type ProjectionAssumptionView =
  | {
      kind: "commitments_already_discounted";
      amount: string;
      refs: string[];
    }
  | {
      kind: "daily_pace";
      amount: string;
      basis: string;
      refs: string[];
    }
  | { kind: "days_remaining"; value: number; refs: [] }
  | {
      kind: "future_income";
      amount: string;
      basis: "not_available_v1";
      refs: [];
    };

export type PeriodProjectionView = {
  available: boolean;
  reason:
    | "no_balance_data"
    | "no_movements"
    | "fewer_than_7_observable_days"
    | null;
  currency: "PEN";
  period_start: string;
  period_end: string;
  as_of: string;
  projection: string | null;
  range: { min: string; max: string } | null;
  free_money: string;
  daily_pace: string;
  observed_days: number;
  days_remaining: number;
  assumptions: ProjectionAssumptionView[];
};

export type ProjectionBreakdownView = {
  available: boolean;
  currency: "PEN";
  period_start: string;
  period_end: string;
  lines: Array<{
    kind:
      | "free_money"
      | "free_in_accounts"
      | "commitments_already_discounted"
      | "daily_pace"
      | "projected_close";
    amount: string | null;
    multiplier?: number;
    refs: string[];
  }>;
};

export type MonthlySituationView = {
  currency: "PEN";
  period_start: string;
  period_end: string;
  as_of: string;
  coverage: {
    availability: "available";
    uncovered: string;
    covered: boolean;
    refs: string[];
  };
  spending_income: {
    availability: "available" | "not_available";
    spending: string;
    income: string;
    ratio_percent: number | null;
    refs: string[];
  };
  reserve: {
    availability: "available";
    total: string;
    refs: string[];
  };
  debts: {
    availability: "available";
    overdue_count: number;
    due_this_month_count: number;
    refs: string[];
  };
  summary_facts: string[];
};

export type ExpenseSimulationView = {
  currency: "PEN";
  parts: [
    {
      kind: "immediate_effect";
      free_money_before: string;
      simulated_amount: string;
      free_money_after: string;
    },
    {
      kind: "already_counted";
      uncovered_commitments: string;
      refs: string[];
    },
    {
      kind: "projected_close";
      available: boolean;
      projection: string | null;
      range: { min: string; max: string } | null;
      assumptions: ProjectionAssumptionView[];
    },
  ];
};
