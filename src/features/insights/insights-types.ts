import type {
  CategoryId,
  InsightCandidate,
  MovementType,
} from "@/shared/types/domain";

export type InsightActionType =
  | "view_movements"
  | "assign_account"
  | "watch_category"
  | "review_debt"
  | "confirm_recurring"
  | "view_money"
  | "dismiss";

export type InsightAction = {
  type: InsightActionType;
  target_view: "movements" | "money" | "debts" | "upcoming" | "insights";
  filters?: Record<string, unknown>;
};

export type InsightDeliverySummary = {
  channel: string;
  status: string;
  delivered_at: string | null;
  seen_at: string | null;
  created_at: string;
};

export type InsightDetail = {
  insight: InsightCandidate;
  deliveries: InsightDeliverySummary[];
};

export type InsightEvidenceMovement = {
  id: string;
  type: MovementType;
  amount: number;
  currency: "PEN" | "USD";
  occurred_at: string;
  description: string | null;
  merchant: string | null;
  category_id: CategoryId | null;
};

export type InsightEvidence = {
  insight_id: string;
  status: InsightCandidate["status"];
  period: {
    start: string;
    end: string;
  };
  evidence_text: string;
  evidence: Record<string, unknown>;
  source_facts: Record<string, unknown>;
  source_entity_ids: string[];
  confidence: number;
  action: Record<string, unknown> | null;
  methodology: unknown;
  related_movements: InsightEvidenceMovement[];
};

export function parseInsightAction(value: unknown): InsightAction | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const record = value as Record<string, unknown>;
  const type = record.type;
  const targetView = record.target_view;
  if (!isInsightActionType(type) || !isInsightTargetView(targetView)) return null;

  return {
    type,
    target_view: targetView,
    filters:
      record.filters &&
      typeof record.filters === "object" &&
      !Array.isArray(record.filters)
        ? (record.filters as Record<string, unknown>)
        : undefined,
  };
}

function isInsightActionType(value: unknown): value is InsightActionType {
  return [
    "view_movements",
    "assign_account",
    "watch_category",
    "review_debt",
    "confirm_recurring",
    "view_money",
    "dismiss",
  ].includes(String(value));
}

function isInsightTargetView(
  value: unknown,
): value is InsightAction["target_view"] {
  return ["movements", "money", "debts", "upcoming", "insights"].includes(
    String(value),
  );
}
