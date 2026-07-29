import type { Account, Box, Movement } from "@/shared/types/domain";
import { ApiClientError, clientIdempotencyKey, parseApiResponse } from "./http-client";
import type { MoneyDashboardResponse } from "./money-types";

export { ApiClientError };

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
  /** ACT-CUENTAS-05: solo `true` — no existe "desmarcar sin reemplazo". */
  is_default?: true;
};

export type CreateBoxPayload = {
  account_id: string;
  name: string;
  type: Box["type"];
  initial_balance: number;
  target_amount?: number | null;
  target_date?: string | null;
};

export type UpdateBoxPayload = {
  name?: string;
  type?: Box["type"];
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
  const response = await fetch("/api/v1/money", { credentials: "same-origin" });
  return parseApiResponse<MoneyDashboardResponse>(response);
}

/** ACT-CUENTAS-04: cuentas archivadas, para poder ofrecer restaurarlas. */
export async function listArchivedAccounts(): Promise<Account[]> {
  const response = await fetch("/api/v1/accounts?include_archived=true", {
    credentials: "same-origin",
  });
  const data = await parseApiResponse<{ accounts: Account[] }>(response);
  return data.accounts.filter((account) => account.deleted_at !== null);
}

export async function createAccount(account: CreateAccountPayload): Promise<Account> {
  const response = await fetch("/api/v1/accounts", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...account, currency: account.currency ?? "PEN" }),
  });
  const data = await parseApiResponse<{ account: Account }>(response);
  return data.account;
}

export async function updateAccount(
  accountId: string,
  account: UpdateAccountPayload
): Promise<Account> {
  const response = await fetch(`/api/v1/accounts/${accountId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(account),
  });
  const data = await parseApiResponse<{ account: Account }>(response);
  return data.account;
}

/** ACT-CUENTAS-03 (24 §5.1): archiva en cascada, sin exigir saldo cero. */
export async function archiveAccount(
  accountId: string,
  reason = "mi_dinero_archive_account"
): Promise<{ account_id: string; archived_box_count: number; released_balance: number }> {
  const response = await fetch(`/api/v1/accounts/${accountId}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return parseApiResponse(response);
}

/** ACT-CUENTAS-04: reactiva la cuenta y sus cajas archivadas. */
export async function restoreAccount(
  accountId: string
): Promise<{ account: Account; restored_box_count: number }> {
  const response = await fetch(`/api/v1/accounts/${accountId}/restore`, {
    method: "POST",
    credentials: "same-origin",
  });
  return parseApiResponse(response);
}

/** 24 §10: detalle de cuenta (SCR-CUENTAS-02). */
export async function getAccountDetail(
  accountId: string
): Promise<{ account: Account; free_balance: number; boxes: Box[] }> {
  const response = await fetch(`/api/v1/accounts/${accountId}`, { credentials: "same-origin" });
  return parseApiResponse(response);
}

/** 24 §10: detalle de caja (SCR-CUENTAS-03). */
export async function getBoxDetail(
  boxId: string
): Promise<{ box: Box; account: Account | null }> {
  const response = await fetch(`/api/v1/boxes/${boxId}`, { credentials: "same-origin" });
  return parseApiResponse(response);
}

export async function createBox(box: CreateBoxPayload): Promise<Box> {
  const response = await fetch("/api/v1/boxes", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(box),
  });
  const data = await parseApiResponse<{ box: Box }>(response);
  return data.box;
}

export async function updateBox(boxId: string, box: UpdateBoxPayload): Promise<Box> {
  const response = await fetch(`/api/v1/boxes/${boxId}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(box),
  });
  const data = await parseApiResponse<{ box: Box }>(response);
  return data.box;
}

/** RUL-CUENTAS-14: elimina y devuelve el saldo separado a libre. */
export async function deleteBox(
  boxId: string,
  reason = "mi_dinero_delete_box"
): Promise<{ box_id: string; released_amount: number }> {
  const response = await fetch(`/api/v1/boxes/${boxId}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return parseApiResponse(response);
}

export async function executeMoneyAction(
  action: MoneyActionPayload
): Promise<{ movement: Movement; idempotent: boolean }> {
  const response = await fetch("/api/v1/money/actions", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": clientIdempotencyKey(`mi-dinero:${action.action}`),
    },
    body: JSON.stringify(action),
  });
  return parseApiResponse(response);
}
