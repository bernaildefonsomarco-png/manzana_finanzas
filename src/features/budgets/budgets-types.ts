import type {
  BudgetKind,
  BudgetPeriodKind,
  BudgetProgressBand,
} from "@/core/budgets";
import type { Box, CategoryId, Movement } from "@/shared/types/domain";

export type BudgetView = {
  id: string;
  category_id: CategoryId | null;
  category_name: string | null;
  currency: "PEN";
  period_kind: BudgetPeriodKind;
  period_start: string;
  period_end: string;
  base_amount: number;
  rollover_amount: number;
  amount: number;
  kind: BudgetKind;
  rollover: boolean;
  auto_renew: boolean;
  alerted_thresholds: number[];
  source: "manual" | "sugerido";
  status: "activo" | "pausado" | "archivado";
  spent: number;
  remaining: number;
  pct: number;
  percentage: number;
  percentage_exact: number;
  band: BudgetProgressBand;
  movement_ids: string[];
  created_at: string;
};

export type BudgetDetailView = BudgetView & {
  movements: Movement[];
  snapshots: Array<{
    id: string;
    as_of: string;
    spent: number;
    remaining: number;
    pct: number;
  }>;
};

export type GoalView = {
  id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  box_id: string | null;
  currency: "PEN";
  status: "activa" | "alcanzada" | "pausada" | "archivada";
  box: Box | null;
  current_balance: number | null;
  progress_pct: number | null;
  monthly_pace: number | null;
  created_at: string;
};

export type BudgetSuggestionView = {
  id: string;
  category_id: CategoryId;
  period_kind: BudgetPeriodKind;
  proposed_amount: number;
  evidence: Array<{
    period_start: string;
    period_end: string;
    spent: number;
  }>;
};

export type BudgetCreatePayload = {
  amount: number;
  category_id: CategoryId | null;
  period_kind: BudgetPeriodKind;
  kind: BudgetKind;
  rollover: boolean;
  auto_renew: boolean;
};

export type BudgetUpdatePayload = {
  amount?: number;
  kind?: BudgetKind;
  rollover?: boolean;
  auto_renew?: boolean;
};

export type GoalCreatePayload = {
  name: string;
  target_amount: number;
  target_date: string | null;
  box_id?: string | null;
};
