import type {
  Account,
  Debt,
  Movement,
  PendingItem,
  RecurringOccurrence,
  RecurringRule,
} from "@/shared/types/domain";
import { ApiClientError, type ApiResponse } from "@/features/movements/movements-api";

export type PendingSummaryPatch = Partial<PendingItem["normalized_summary"]>;
export type PendingActionPatch = {
  action?:
    | "create_movement"
    | "record_transfer"
    | "record_debt_payment"
    | "record_recurring_payment"
    | "review_specialized";
  account_id?: string | null;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
  debt_id?: string | null;
  recurring_rule_id?: string | null;
  recurring_occurrence_id?: string | null;
};
export type PendingRecurringOption = RecurringRule & {
  occurrences: RecurringOccurrence[];
};

export async function listPendingItems(): Promise<PendingItem[]> {
  const response = await fetch("/api/v1/pending?limit=50", {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<{
    pending_items: PendingItem[];
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.pending_items;
}

export async function listPendingAccounts(): Promise<Account[]> {
  const response = await fetch("/api/v1/accounts", {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<{
    accounts: Account[];
  }>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }
  return payload.data.accounts;
}

export async function listPendingDebts(): Promise<Debt[]> {
  const response = await fetch("/api/v1/debts", {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<{ debts: Debt[] }>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }
  return payload.data.debts;
}

export async function listPendingRecurring(): Promise<
  PendingRecurringOption[]
> {
  const response = await fetch("/api/v1/recurring?status=active", {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<{
    rules: PendingRecurringOption[];
  }>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }
  return payload.data.rules;
}

export async function updatePendingItem(
  pendingItemId: string,
  normalizedSummary: PendingSummaryPatch,
  proposedAction?: PendingActionPatch,
): Promise<PendingItem> {
  const response = await fetch(`/api/v1/pending/${pendingItemId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      normalized_summary: normalizedSummary,
      ...(proposedAction ? { proposed_action: proposedAction } : {}),
      reason: "dashboard_pending_edit",
    }),
  });
  const payload = (await response.json()) as ApiResponse<{
    pending_item: PendingItem;
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.pending_item;
}

export async function confirmPendingItem(
  pendingItemId: string,
  options: { confirmDuplicate?: boolean } = {}
): Promise<{
  pending_item: PendingItem;
  movement: Movement;
  idempotent: boolean;
  auto_resolved_duplicate: boolean;
}> {
  const response = await fetch(`/api/v1/pending/${pendingItemId}/confirm`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      confirm_duplicate: options.confirmDuplicate ?? false,
    }),
  });
  const payload = (await response.json()) as ApiResponse<{
    pending_item: PendingItem;
    movement: Movement;
    idempotent: boolean;
    auto_resolved_duplicate: boolean;
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
      payload.error.details ?? {}
    );
  }

  return payload.data;
}

export async function batchConfirmPendingItems(
  pendingItemIds: string[],
): Promise<{
  requested: number;
  confirmed: number;
  failed: number;
  results: Array<{
    pending_item_id: string;
    status: "confirmed" | "failed";
    movement_id?: string;
    idempotent?: boolean;
    auto_resolved_duplicate?: boolean;
    code?: string;
    requires_duplicate_confirmation?: boolean;
  }>;
}> {
  const response = await fetch("/api/v1/pending/batch-confirm", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pending_item_ids: pendingItemIds }),
  });
  const payload = (await response.json()) as ApiResponse<{
    requested: number;
    confirmed: number;
    failed: number;
    results: Array<{
      pending_item_id: string;
      status: "confirmed" | "failed";
      movement_id?: string;
      idempotent?: boolean;
      auto_resolved_duplicate?: boolean;
      code?: string;
      requires_duplicate_confirmation?: boolean;
    }>;
  }>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }
  return payload.data;
}

export async function batchDiscardPendingItems(
  pendingItemIds: string[],
): Promise<{
  requested: number;
  discarded: number;
  failed: number;
  results: Array<{
    pending_item_id: string;
    status: "discarded" | "failed";
    code?: string;
  }>;
}> {
  const response = await fetch("/api/v1/pending/batch-discard", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pending_item_ids: pendingItemIds,
      reason: "dashboard_batch_discard",
    }),
  });
  const payload = (await response.json()) as ApiResponse<{
    requested: number;
    discarded: number;
    failed: number;
    results: Array<{
      pending_item_id: string;
      status: "discarded" | "failed";
      code?: string;
    }>;
  }>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
    );
  }
  return payload.data;
}

export async function discardPendingItem(
  pendingItemId: string,
  reason = "dashboard_pending_discard"
): Promise<PendingItem> {
  const response = await fetch(`/api/v1/pending/${pendingItemId}/discard`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });
  const payload = (await response.json()) as ApiResponse<{
    pending_item: PendingItem;
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.pending_item;
}
