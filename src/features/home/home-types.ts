import type { Movement } from "@/shared/types/domain";
import type { InitialOnboardingSummary } from "@/core/onboarding/onboarding-activation";

export type HomeMoneySummary = {
  total_balance: number;
  separated_balance: number;
  free_balance: number;
  currency: "PEN";
  account_count: number;
  box_count: number;
};

export type HomePendingSummary = {
  active_count: number;
  needs_completion_count: number;
  high_risk_count: number;
};

export type HomeCommitmentSummary = {
  id: string;
  title: string;
  amount: number;
  due_at: string;
  kind: "debt" | "recurring" | "box";
};

export type HomeInsightCard = {
  title: string;
  body: string;
  evidence: string;
  tone: "progress" | "useful" | "attention";
};

export type HomeSuggestedAction = {
  label: string;
  description: string;
  target_view: "movements" | "pending" | "money" | "insights";
  priority: "primary" | "secondary";
};

export type HomeDashboardNudge = {
  id: string;
  type:
    | "payment_due"
    | "overdue_payment"
    | "pending_review"
    | "debt_due"
    | "insight_prompt";
  title: string;
  body: string;
  evidence: string | null;
  action_label: string;
  target_view: "upcoming" | "pending" | "debts" | "insights";
  priority: number;
  scheduled_for: string | null;
  debt_id: string | null;
  installment_id: string | null;
};

export type HomeDataQualitySummary = {
  confirmed_movements_count: number;
  movements_without_account_count: number;
  has_accounts: boolean;
  message: string;
};

export type HomeDashboardSummary = {
  money_summary: HomeMoneySummary | null;
  pending_summary: HomePendingSummary;
  recent_movements: Movement[];
  next_commitments: HomeCommitmentSummary[];
  dashboard_nudges: HomeDashboardNudge[];
  featured_insight: HomeInsightCard | null;
  suggested_action: HomeSuggestedAction | null;
  data_quality: HomeDataQualitySummary;
  onboarding: InitialOnboardingSummary;
};
