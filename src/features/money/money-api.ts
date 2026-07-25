import type { Account, Box, BoxType, Movement } from "@/shared/types/domain";
import type { ApiResponse } from "@/features/movements/movements-api";
import { ApiClientError } from "@/features/movements/movements-api";
import type { MoneyDashboardResponse } from "./money-types";

export type CreateAccountPayload = {
  name: string;
  type: Account["type"];
  institution: string | null;
  initial_balance: number;
  currency?: "PEN" | "USD";
};

export type UpdateAccountPayload = {
  name?: string;
  type?: Account["type"];
  institution?: string | null;
  color?: string | null;
  icon?: string | null;
};

export type CreateBoxPayload = {
  account_id: string;
  name: string;
  type: BoxType;
  initial_balance: number;
  target_amount?: number | null;
  target_date?: string | null;
};

export type UpdateBoxPayload = {
  name?: string;
  type?: BoxType;
  target_amount?: number | null;
  target_date?: string | null;
};

export type MoneyActionPayload =
  | {
      action: "adjust_account_balance";
      account_id: string;
      target_balance: number;
      reason?: string;
    }
  | {
      action: "transfer_between_accounts";
      from_account_id: string;
      to_account_id: string;
      amount: number;
      description?: string;
    }
  | {
      action: "move_box_money";
      mode: "separate_to_box" | "release_from_box" | "box_to_box";
      amount: number;
      box_origin_id?: string | null;
      box_destination_id?: string | null;
      description?: string;
    };

export async function getMoneyDashboard(): Promise<MoneyDashboardResponse> {
  const response = await fetch("/api/v1/money", {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<MoneyDashboardResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data;
}

export async function createAccount(
  account: CreateAccountPayload
): Promise<Account> {
  const response = await fetch("/api/v1/accounts", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...account,
      currency: account.currency ?? "PEN",
    }),
  });

  const payload = (await response.json()) as ApiResponse<{ account: Account }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.account;
}

export async function updateAccount(
  accountId: string,
  account: UpdateAccountPayload
): Promise<Account> {
  const response = await fetch(`/api/v1/accounts/${accountId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(account),
  });

  const payload = (await response.json()) as ApiResponse<{ account: Account }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.account;
}

export async function deleteAccount(
  accountId: string,
  reason = "user_deleted_account"
): Promise<{ account_id: string }> {
  const response = await fetch(`/api/v1/accounts/${accountId}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  const payload = (await response.json()) as ApiResponse<{ account_id: string }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data;
}

export async function createBox(box: CreateBoxPayload): Promise<Box> {
  const response = await fetch("/api/v1/boxes", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(box),
  });

  const payload = (await response.json()) as ApiResponse<{ box: Box }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.box;
}

export async function updateBox(
  boxId: string,
  box: UpdateBoxPayload
): Promise<Box> {
  const response = await fetch(`/api/v1/boxes/${boxId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(box),
  });

  const payload = (await response.json()) as ApiResponse<{ box: Box }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.box;
}

export async function deleteBox(
  boxId: string,
  reason = "user_deleted_box"
): Promise<{ box_id: string; released_amount: number }> {
  const response = await fetch(`/api/v1/boxes/${boxId}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ reason }),
  });

  const payload = (await response.json()) as ApiResponse<{
    box_id: string;
    released_amount: number;
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data;
}

export async function executeMoneyAction(
  action: MoneyActionPayload
): Promise<{ movement: Movement; idempotent: boolean }> {
  const response = await fetch("/api/v1/money/actions", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": createClientIdempotencyKey(action.action),
    },
    body: JSON.stringify(action),
  });

  const payload = (await response.json()) as ApiResponse<{
    action: MoneyActionPayload["action"];
    movement: Movement;
    idempotent: boolean;
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return {
    movement: payload.data.movement,
    idempotent: payload.data.idempotent,
  };
}

function createClientIdempotencyKey(action: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `dashboard-money:${action}:${random}`;
}
