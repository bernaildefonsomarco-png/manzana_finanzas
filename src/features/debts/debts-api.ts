import type { ApiResponse } from "@/features/movements/movements-api";
import { ApiClientError } from "@/features/movements/movements-api";
import type {
  CreateDebtPayload,
  CreateDebtPaymentPayload,
  DebtDetailResponse,
  DebtDetailWithPayments,
  DebtPaymentAccountsResponse,
  DebtPaymentResponse,
  DebtWithPerson,
  DebtsResponse,
} from "./debts-types";

export async function listDebts(): Promise<DebtsResponse> {
  const response = await fetch("/api/v1/debts", {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<DebtsResponse>;

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

export async function getDebtDetail(debtId: string): Promise<DebtDetailWithPayments> {
  const response = await fetch(`/api/v1/debts/${debtId}`, {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<DebtDetailResponse>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.debt;
}

export async function createDebt(payload: CreateDebtPayload): Promise<DebtWithPerson> {
  const response = await fetch("/api/v1/debts", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const apiPayload = (await response.json()) as ApiResponse<{
    debt: DebtWithPerson;
  }>;

  if (!apiPayload.ok) {
    throw new ApiClientError(
      apiPayload.error.code,
      apiPayload.error.message,
      response.status,
      apiPayload.meta?.trace_id ?? null
    );
  }

  return apiPayload.data.debt;
}

export async function listDebtPaymentAccounts(): Promise<DebtPaymentAccountsResponse> {
  const response = await fetch("/api/v1/accounts", {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<DebtPaymentAccountsResponse>;

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

export async function createDebtPayment(
  debtId: string,
  payload: CreateDebtPaymentPayload
): Promise<DebtPaymentResponse> {
  const response = await fetch(`/api/v1/debts/${debtId}/payments`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": createClientIdempotencyKey(debtId),
    },
    body: JSON.stringify(payload),
  });

  const apiPayload = (await response.json()) as ApiResponse<DebtPaymentResponse>;

  if (!apiPayload.ok) {
    throw new ApiClientError(
      apiPayload.error.code,
      apiPayload.error.message,
      response.status,
      apiPayload.meta?.trace_id ?? null
    );
  }

  return apiPayload.data;
}

function createClientIdempotencyKey(debtId: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `dashboard-debt-payment:${debtId}:${random}`;
}
