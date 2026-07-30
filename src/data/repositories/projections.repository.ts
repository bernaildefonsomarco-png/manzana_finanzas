import type { SupabaseClient } from "@supabase/supabase-js";
import {
  calculateMonthlySituation,
  calculatePeriodProjection,
  simulateExpense,
  type ExpenseSimulation,
  type MonthlySituation,
  type PeriodProjection,
  type ProjectionMovement,
  type SituationInstallment,
} from "@/core/projections";
import { calculateMoneyLayers } from "@/core/finance/money-layers";
import { mergeUpcomingCommitments } from "@/core/recurring/upcoming-commitments";
import {
  getActiveAccounts,
  getActiveBoxes,
} from "@/data/repositories/accounts.repository";
import {
  listDebtInstallmentCommitments,
  type DebtInstallmentCommitmentSummary,
} from "@/data/repositories/debts.repository";
import {
  listUpcomingCommitments,
  type UpcomingCommitmentSummary,
} from "@/data/repositories/recurring.repository";
import type { Database } from "@/data/supabase/types";
import {
  addCalendarDays,
  daysInMonth,
  isoDateInLima,
  limaLocalInputToUtcIso,
  parseIsoDate,
  toIsoDate,
} from "@/shared/dates/lima";
import type { Account, Box, Movement } from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export type ProjectionSnapshot = {
  projection: PeriodProjection;
  situation: MonthlySituation;
  has_pen_accounts: boolean;
  breakdown: ProjectionBreakdown;
};

export type ProjectionBreakdown = {
  currency: "PEN";
  lines: Array<{
    kind:
      | "free_money"
      | "free_in_accounts"
      | "commitments_already_discounted"
      | "daily_pace"
      | "projected_close";
    amount_cents: number | null;
    multiplier?: number;
    refs: string[];
  }>;
};

export async function getProjectionSnapshot(
  client: Client,
  userId: string,
  now = new Date()
): Promise<ProjectionSnapshot> {
  const calendar = currentMonthWindow(now);
  const horizonDays = Math.max(
    0,
    daysBetween(calendar.today, calendar.end)
  );
  const [accounts, boxes, recurring, debts, movements] = await Promise.all([
    getActiveAccounts(client, userId),
    getActiveBoxes(client, userId),
    listUpcomingCommitments(client, userId, horizonDays, now),
    listDebtInstallmentCommitments(client, userId, horizonDays, now),
    listProjectionMovements(client, userId, calendar.start, calendar.today),
  ]);
  const commitments = mergeUpcomingCommitments(recurring, debts).filter(
    (commitment) =>
      commitment.currency === "PEN" && commitment.due_at <= calendar.end
  );
  const penAccounts = accounts.filter((account) => account.currency === "PEN");
  const penAccountIds = new Set(penAccounts.map((account) => account.id));
  const penBoxes = boxes.filter((box) => penAccountIds.has(box.account_id));
  const layers = calculateMoneyLayers({
    accounts: penAccounts.map((account) => ({
      current_balance: Number(account.current_balance),
    })),
    boxes: penBoxes.map((box) => ({
      id: box.id,
      current_balance: Number(box.current_balance),
    })),
    commitments: commitments.map((commitment) => ({
      id: commitment.id,
      amount: Number(commitment.amount),
      linked_box_id: commitment.linked_box_id,
      due_at: commitment.due_at,
    })),
  });
  const projectionMovements = movements.map(toProjectionMovement);
  const commitmentRefs = commitments.map((commitment) => commitment.id);
  const projection = calculatePeriodProjection({
    now,
    freeMoneyCents: toCents(layers.operational_free_money),
    uncoveredCommitmentsCents: toCents(
      layers.upcoming_uncovered_commitments
    ),
    commitmentRefs,
    movements: projectionMovements,
  });
  const situation = calculateMonthlySituation({
    now,
    uncoveredCommitmentsCents: toCents(
      layers.upcoming_uncovered_commitments
    ),
    commitmentRefs,
    movements: projectionMovements,
    boxes: penBoxes.map((box) => ({
      id: box.id,
      current_balance_cents: toCents(Number(box.current_balance)),
      currency: "PEN",
      deleted_at: box.deleted_at,
    })),
    installments: debts.map((debt) => toSituationInstallment(debt, calendar.today)),
  });

  return {
    projection,
    situation,
    has_pen_accounts: penAccounts.length > 0,
    breakdown: buildProjectionBreakdown(
      projection,
      layers.free_in_accounts,
      layers.upcoming_uncovered_commitments
    ),
  };
}

export async function simulateProjectionExpense(
  client: Client,
  userId: string,
  input: {
    amount: number;
    categoryId?: string | null;
    date?: string;
    now?: Date;
  }
): Promise<{
  simulation: ExpenseSimulation;
  projection: PeriodProjection;
  has_pen_accounts: boolean;
  budget_effect: {
    category_id: string;
    simulated_amount: number;
  } | null;
}> {
  const now = input.now ?? new Date();
  const today = isoDateInLima(now);
  const window = currentMonthWindow(now);
  const date = input.date ?? today;
  if (date < today) {
    throw new ProjectionInputError(
      "SIMULATION_DATE_PAST",
      "Esa fecha ya paso."
    );
  }
  if (date > window.end) {
    throw new ProjectionInputError(
      "SIMULATION_DATE_OUTSIDE_PERIOD",
      "La simulacion V1 termina al cierre de este mes."
    );
  }
  const snapshot = await getProjectionSnapshot(client, userId, now);
  return {
    simulation: simulateExpense({
      projection: snapshot.projection,
      amountCents: toCents(input.amount),
    }),
    projection: snapshot.projection,
    has_pen_accounts: snapshot.has_pen_accounts,
    budget_effect: input.categoryId
      ? {
          category_id: input.categoryId,
          simulated_amount: input.amount,
        }
      : null,
  };
}

export class ProjectionInputError extends Error {
  constructor(
    readonly code:
      | "SIMULATION_DATE_PAST"
      | "SIMULATION_DATE_OUTSIDE_PERIOD",
    message: string
  ) {
    super(message);
    this.name = "ProjectionInputError";
  }
}

async function listProjectionMovements(
  client: Client,
  userId: string,
  periodStart: string,
  today: string
): Promise<Movement[]> {
  const from = limaLocalInputToUtcIso(`${periodStart}T00:00`);
  const until = limaLocalInputToUtcIso(
    `${addCalendarDays(today, 1)}T00:00`
  );
  const { data, error } = await client
    .from("movements")
    .select("*")
    .eq("user_id", userId)
    .eq("currency", "PEN")
    .in("status", ["confirmed", "needs_review", "corrected"])
    .gte("occurred_at", from)
    .lt("occurred_at", until)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    logger.error("projections.movements_failed", {
      error,
      user_id: userId,
    });
    throw error;
  }
  return (data ?? []) as Movement[];
}

function toProjectionMovement(movement: Movement): ProjectionMovement {
  return {
    id: movement.id,
    type: movement.type,
    amount_cents: toCents(Number(movement.amount)),
    currency: movement.currency,
    occurred_at: movement.occurred_at,
    status: movement.status,
    deleted_at: movement.deleted_at,
    recurring_rule_id: movement.recurring_rule_id,
    recurring_occurrence_id: movement.recurring_occurrence_id,
    debt_id: movement.debt_id,
  };
}

function toSituationInstallment(
  commitment: DebtInstallmentCommitmentSummary,
  today: string
): SituationInstallment {
  return {
    id: commitment.installment_id,
    direction: commitment.direction,
    status: commitment.due_at < today ? "overdue" : "pending",
    due_date: commitment.due_at,
  };
}

function buildProjectionBreakdown(
  projection: PeriodProjection,
  freeInAccounts: number,
  uncoveredCommitments: number
): ProjectionBreakdown {
  const paceRefs =
    projection.assumptions.find((item) => item.kind === "daily_pace")?.refs ??
    [];
  const commitmentRefs =
    projection.assumptions.find(
      (item) => item.kind === "commitments_already_discounted"
    )?.refs ?? [];
  return {
    currency: "PEN",
    lines: [
      {
        kind: "free_money",
        amount_cents: projection.free_money_cents,
        refs: [],
      },
      {
        kind: "free_in_accounts",
        amount_cents: toCents(freeInAccounts),
        refs: [],
      },
      {
        kind: "commitments_already_discounted",
        amount_cents: toCents(uncoveredCommitments),
        refs: commitmentRefs,
      },
      {
        kind: "daily_pace",
        amount_cents: projection.daily_pace_cents,
        multiplier: projection.days_remaining,
        refs: paceRefs,
      },
      {
        kind: "projected_close",
        amount_cents: projection.projection_cents,
        refs: [...commitmentRefs, ...paceRefs],
      },
    ],
  };
}

function currentMonthWindow(now: Date) {
  const today = isoDateInLima(now);
  const parts = parseIsoDate(today);
  if (!parts) throw new Error("No se pudo resolver el mes Lima.");
  return {
    today,
    start: toIsoDate(parts.year, parts.month, 1),
    end: toIsoDate(
      parts.year,
      parts.month,
      daysInMonth(parts.year, parts.month)
    ),
  };
}

function daysBetween(from: string, to: string): number {
  const left = parseIsoDate(from);
  const right = parseIsoDate(to);
  if (!left || !right) return 0;
  return Math.round(
    (Date.UTC(right.year, right.month, right.day) -
      Date.UTC(left.year, left.month, left.day)) /
      86_400_000
  );
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

// Mantiene explícitos los orígenes del cálculo en el tipo de este módulo.
export type ProjectionDataSources = {
  accounts: Account[];
  boxes: Box[];
  commitments: Array<
    UpcomingCommitmentSummary | DebtInstallmentCommitmentSummary
  >;
  movements: Movement[];
};
