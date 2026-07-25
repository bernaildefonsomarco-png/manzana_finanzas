import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateCrossChannelDedup } from "./cross-channel-preflight";
import {
  listPendingItems,
  markPendingAutoResolvedDuplicate,
} from "@/data/repositories/pending.repository";
import type { Database } from "@/data/supabase/types";
import type { MovementInput } from "@/shared/schemas/money";
import {
  MOVEMENT_TYPES,
  type MovementType,
  type PendingItem,
} from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

type ReconciledMovement = {
  movement_id: string;
  movement_type: MovementType;
  amount: number;
  currency: "PEN" | "USD";
  occurred_at: string;
  description: string | null;
  category_id: string | null;
  account_origin_id: string | null;
  account_destination_id: string | null;
};

export type EmailPendingReconciliationResult = {
  evaluated: number;
  auto_resolved: number;
  pending_item_ids: string[];
};

export async function reconcileEmailPendingAfterMovements(params: {
  client: Client;
  userId: string;
  movements: ReconciledMovement[];
  traceId: string;
}): Promise<EmailPendingReconciliationResult> {
  if (params.movements.length === 0) return emptyResult();

  const pendingItems = await listPendingItems(params.client, params.userId, {
    source: "email_pending",
    limit: 100,
  });
  const result = emptyResult();
  const recentMovements = params.movements.map((movement) => ({
    reference_id: movement.movement_id,
    movement_type: movement.movement_type,
    amount: movement.amount,
    currency: movement.currency,
    occurred_at: movement.occurred_at,
    description: movement.description,
    merchant: movement.description,
    source: "whatsapp" as const,
    source_ref: null,
    account_origin_id: movement.account_origin_id,
    account_destination_id: movement.account_destination_id,
  }));

  for (const pendingItem of pendingItems) {
    const movementInput = pendingToMovementInput(pendingItem);
    if (!movementInput) continue;
    result.evaluated += 1;

    const dedup = await evaluateCrossChannelDedup({
      client: params.client,
      userId: params.userId,
      traceId: params.traceId,
      referenceId: `pending:${pendingItem.id}`,
      movementInput,
      recentMovements,
      metadata: {
        entry_surface: "post_whatsapp_email_reconciliation",
        pending_item_id: pendingItem.id,
      },
    });
    const decision = dedup.decision;
    if (
      decision?.status !== "exact_duplicate" ||
      !decision.matched_reference_id
    ) {
      continue;
    }

    await markPendingAutoResolvedDuplicate(
      params.client,
      params.userId,
      pendingItem.id,
      decision.matched_reference_id,
      params.userId,
      params.traceId,
    );
    result.auto_resolved += 1;
    result.pending_item_ids.push(pendingItem.id);
  }

  return result;
}

function pendingToMovementInput(pendingItem: PendingItem): MovementInput | null {
  const summary = pendingItem.normalized_summary;
  if (
    typeof summary.amount !== "number" ||
    !Number.isFinite(summary.amount) ||
    !summary.occurred_at
  ) {
    return null;
  }
  const proposed = pendingItem.proposed_action;
  const nestedInput = asRecord(proposed.movement_input);
  const proposedType = proposed.movement_type;
  const movementType = isMovementType(proposedType)
    ? proposedType
    : pendingItem.metadata.money_sign === "positive"
      ? "ingreso"
      : "gasto";
  const title = summary.title?.trim() || null;

  return {
    type: movementType,
    amount: Math.abs(summary.amount),
    currency: summary.currency ?? "PEN",
    occurred_at: summary.occurred_at,
    description: title,
    merchant: title,
    category_id: summary.category_id ?? null,
    subcategory_id: null,
    account_origin_id: readString(nestedInput.account_origin_id),
    account_destination_id: readString(nestedInput.account_destination_id),
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: "email_confirmed",
    source_ref: `pending:${pendingItem.id}`,
    confidence: null,
    requires_review: false,
    metadata: {
      pending_item_id: pendingItem.id,
      reconciliation_only: true,
    },
  };
}

function isMovementType(value: unknown): value is MovementType {
  return (
    typeof value === "string" &&
    MOVEMENT_TYPES.includes(value as MovementType)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function emptyResult(): EmailPendingReconciliationResult {
  return { evaluated: 0, auto_resolved: 0, pending_item_ids: [] };
}
