import type {
  CategoryId,
  InsightStatus,
  InsightType,
  MovementType,
  RiskLevel,
} from "@/shared/types/domain";

export type PublicInsight = {
  id: string;
  type: InsightType;
  class: "A" | "B" | "C";
  status: InsightStatus;
  period_start: string;
  period_end: string;
  risk_level: RiskLevel;
  title: string;
  body: string;
  evidence_text: string;
  evidence_refs: string[];
  action: Record<string, unknown> | null;
  feedback: "util" | "no_util" | null;
  expires_at: string | null;
  displayed_at: string | null;
  changed_notice: string | null;
  created_at: string;
  updated_at: string;
};

export type InsightAction = {
  type:
    | "view_movements"
    | "assign_account"
    | "watch_category"
    | "review_debt"
    | "confirm_recurring"
    | "view_money"
    | "adjust_budget"
    | "link_goal"
    | "create_box"
    | "dismiss";
  target_view: "movements" | "money" | "debts" | "upcoming" | "insights";
  filters?: Record<string, unknown>;
};

export type InsightDetail = {
  insight: PublicInsight;
  deliveries: Array<{
    channel: string;
    status: string;
    delivered_at: string | null;
    seen_at: string | null;
    created_at: string;
  }>;
};

export type InsightEvidence = {
  insight_id: string;
  status: InsightStatus;
  period: { start: string; end: string };
  evidence_text: string;
  evidence: Record<string, unknown>;
  source_facts: Record<string, unknown>;
  source_entity_ids: string[];
  action: Record<string, unknown> | null;
  methodology: unknown;
  related_movements: Array<{
    id: string;
    type: MovementType;
    amount: number;
    currency: "PEN" | "USD";
    occurred_at: string;
    description: string | null;
    merchant: string | null;
    category_id: CategoryId | null;
  }>;
};

export function parseInsightAction(value: unknown): InsightAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const types = [
    "view_movements", "assign_account", "watch_category", "review_debt",
    "confirm_recurring", "view_money", "adjust_budget", "link_goal",
    "create_box", "dismiss",
  ];
  const views = ["movements", "money", "debts", "upcoming", "insights"];
  if (!types.includes(String(record.type)) || !views.includes(String(record.target_view))) {
    return null;
  }
  return {
    type: record.type as InsightAction["type"],
    target_view: record.target_view as InsightAction["target_view"],
    filters:
      record.filters && typeof record.filters === "object" && !Array.isArray(record.filters)
        ? record.filters as Record<string, unknown>
        : undefined,
  };
}
