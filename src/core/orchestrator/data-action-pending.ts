import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createPendingItem,
  type CreatePendingItemResult,
} from "@/data/repositories/pending.repository";
import type { Database } from "@/data/supabase/types";
import type {
  PendingItem,
  PendingSource,
  PendingType,
  RiskLevel,
} from "@/shared/types/domain";
import type { DataActionPlan, PlannedDataAction } from "./data-action-policy";

type Client = SupabaseClient<Database>;

export type DataActionPendingCreationResult =
  | {
      kind: "not_created";
      reason: "plan_not_requires_confirmation" | "no_confirmable_actions";
      created_count: 0;
      idempotent_count: 0;
      pending_items: [];
    }
  | {
      kind: "created";
      reason: "pending_items_created";
      created_count: number;
      idempotent_count: number;
      pending_items: CreatedDataActionPendingItem[];
    };

export type CreatedDataActionPendingItem = {
  action_id: string;
  pending_item_id: string;
  idempotent: boolean;
  type: PendingType;
  source: PendingSource;
  risk_level: RiskLevel;
  status: PendingItem["status"];
};

export async function createPendingItemsForDataActionPlan(params: {
  client: Client;
  plan: DataActionPlan;
  userId: string;
  traceId: string;
  externalEventId: string;
  originalMessage: string;
}): Promise<DataActionPendingCreationResult> {
  const confirmableActions = params.plan.actions.filter(
    (action) =>
      action.decision === "requires_confirmation" &&
      action.movement_input !== null &&
      !action.debt_creation_input
  );

  if (confirmableActions.length === 0) {
    return {
      kind: "not_created",
      reason: "no_confirmable_actions",
      created_count: 0,
      idempotent_count: 0,
      pending_items: [],
    };
  }

  const pendingItems: CreatedDataActionPendingItem[] = [];
  let idempotentCount = 0;

  for (const action of confirmableActions) {
    const input = buildPendingInputFromDataAction({
      action,
      userId: params.userId,
      externalEventId: params.externalEventId,
      originalMessage: params.originalMessage,
    });
    const result = await createPendingItem(params.client, {
      ...input,
      traceId: params.traceId,
    });

    if (result.idempotent) idempotentCount += 1;
    pendingItems.push(toCreatedPendingItem(action, result));
  }

  return {
    kind: "created",
    reason: "pending_items_created",
    created_count: pendingItems.length,
    idempotent_count: idempotentCount,
    pending_items: pendingItems,
  };
}

export function buildPendingInputFromDataAction(params: {
  action: PlannedDataAction;
  userId: string;
  externalEventId: string;
  originalMessage: string;
}): {
  userId: string;
  type: PendingType;
  source: PendingSource;
  sourceRef: string;
  proposedAction: Record<string, unknown>;
  normalizedSummary: PendingItem["normalized_summary"];
  riskLevel: RiskLevel;
  metadata: Record<string, unknown>;
} {
  const { action } = params;
  const riskLevel = action.risk_level;
  const pendingKind = pendingKindFromRisk(riskLevel);
  const movementInput = action.movement_input;
  const amount = movementInput?.amount ?? undefined;
  const currency = movementInput?.currency ?? "PEN";
  const categoryId = movementInput?.category_id ?? undefined;
  const title = movementInput?.description ?? "Movimiento por confirmar";

  return {
    userId: params.userId,
    type: pendingKind.type,
    source: pendingKind.source,
    sourceRef: buildPendingSourceRef({
      externalEventId: params.externalEventId,
      actionId: action.action_id,
    }),
    proposedAction: {
      action_id: action.action_id,
      decision: action.decision,
      reasons: action.reasons,
      movement_type: movementInput?.type ?? null,
      movement_input: movementInput,
    },
    normalizedSummary: {
      title,
      subtitle: subtitleFromReasons(action.reasons),
      amount,
      currency,
      occurred_at: movementInput?.occurred_at,
      category_id: categoryId,
      account_hint: accountHintFromReasons(action.reasons),
      confidence_label: confidenceLabelFromReasons(action.reasons),
    },
    riskLevel,
    metadata: {
      created_by: "financial_orchestrator",
      source_channel: "whatsapp",
      external_event_id: params.externalEventId,
      original_message: params.originalMessage,
      action_id: action.action_id,
      policy_reasons: action.reasons,
      money_sign: movementInput?.type === "ingreso" ? "positive" : "negative",
      requires_user_confirmation: true,
    },
  };
}

export function buildPendingSourceRef(params: {
  externalEventId: string;
  actionId: string;
}): string {
  return `whatsapp:${params.externalEventId}:${params.actionId}`;
}

function toCreatedPendingItem(
  action: PlannedDataAction,
  result: CreatePendingItemResult
): CreatedDataActionPendingItem {
  return {
    action_id: action.action_id,
    pending_item_id: result.pendingItem.id,
    idempotent: result.idempotent,
    type: result.pendingItem.type,
    source: result.pendingItem.source,
    risk_level: result.pendingItem.risk_level,
    status: result.pendingItem.status,
  };
}

function pendingKindFromRisk(riskLevel: RiskLevel): {
  type: PendingType;
  source: PendingSource;
} {
  if (riskLevel === "high" || riskLevel === "sensitive") {
    return { type: "risk_confirmation", source: "risk_confirmation" };
  }

  return { type: "ambiguous_movement", source: "ambiguous_movement" };
}

function subtitleFromReasons(reasons: string[]): string {
  if (reasons.includes("account_origin_not_resolved")) {
    return "Falta elegir de que cuenta salio antes de confirmar.";
  }
  if (reasons.includes("account_destination_not_resolved")) {
    return "Falta elegir a que cuenta entro antes de confirmar.";
  }
  if (reasons.includes("sensitive_category")) {
    return "Manzana lo separo para que lo revises con calma.";
  }
  if (reasons.includes("missing_category")) {
    return "Falta categoria antes de confirmar.";
  }
  if (
    reasons.includes("confidence_below_silent_accept") ||
    reasons.includes("confidence_requires_clarification") ||
    reasons.includes("confidence_below_safe_floor")
  ) {
    return "Manzana no esta completamente segura del registro.";
  }

  return "Manzana entendio una parte, pero no quiere asumir.";
}

function accountHintFromReasons(reasons: string[]): string | null {
  if (
    reasons.includes("account_origin_not_resolved") ||
    reasons.includes("account_destination_not_resolved")
  ) {
    return "Falta cuenta";
  }

  return null;
}

function confidenceLabelFromReasons(reasons: string[]): string {
  if (reasons.includes("confidence_below_safe_floor")) {
    return "Confianza baja";
  }
  if (reasons.includes("confidence_requires_clarification")) {
    return "Confianza baja";
  }
  if (reasons.includes("confidence_below_silent_accept")) {
    return "Confianza media";
  }
  if (
    reasons.includes("account_origin_not_resolved") ||
    reasons.includes("account_destination_not_resolved") ||
    reasons.includes("missing_category")
  ) {
    return "Falta completar";
  }
  if (reasons.includes("sensitive_category")) return "Revisar con cuidado";

  return "Por confirmar";
}
