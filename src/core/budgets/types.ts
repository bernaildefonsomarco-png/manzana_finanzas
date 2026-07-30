import type {
  CategoryId,
  MovementStatus,
  MovementType,
} from "@/shared/types/domain";

export const BUDGET_PERIOD_KINDS = [
  "semanal",
  "quincenal",
  "mensual",
] as const;
export type BudgetPeriodKind = (typeof BUDGET_PERIOD_KINDS)[number];

export const BUDGET_KINDS = [
  "presupuesto",
  "limite_blando",
  "limite_duro",
] as const;
export type BudgetKind = (typeof BUDGET_KINDS)[number];

export const BUDGET_PROGRESS_BANDS = [
  "holgado",
  "atencion",
  "cerca",
  "superado",
] as const;
export type BudgetProgressBand = (typeof BUDGET_PROGRESS_BANDS)[number];

export const BUDGET_ACTIVE_MOVEMENT_STATUSES = [
  "confirmed",
  "needs_review",
  "corrected",
] as const satisfies readonly MovementStatus[];

export type BudgetMovement = {
  id: string;
  type: MovementType;
  status: MovementStatus;
  amount: number;
  currency: string;
  category_id: CategoryId | null;
  deleted_at?: string | null;
};

export type BudgetPeriod = {
  start: string;
  end: string;
};

export type BudgetProgress = {
  spent: number;
  remaining: number;
  pct: number;
  percentage: number;
  percentage_exact: number;
  band: BudgetProgressBand;
  movement_ids: string[];
};
