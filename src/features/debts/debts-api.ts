import type { ApiResponse } from "@/features/movements/movements-api";
import { ApiClientError } from "@/features/movements/movements-api";
import type {
  CreateDebtPayload,
  CreateDebtPaymentPayload,
  DebtDetailResponse,
  DebtDetailWithPayments,
  DebtPaymentAccountsResponse,
  DebtPaymentPreview,
  DebtPaymentResponse,
  DebtsResponse,
  DebtWithPerson,
  UpdateDebtPayload,
} from "./debts-types";
import type { Debt, DebtInstallment } from "@/shared/types/domain";

const VISIBLE_STATUSES = "active,due_soon,overdue,paid,cancelled";

export function listDebts(): Promise<DebtsResponse> {
  return apiRequest<DebtsResponse>(
    `/api/v1/debts?status=${encodeURIComponent(VISIBLE_STATUSES)}&limit=100`
  );
}

export async function getDebtDetail(
  debtId: string
): Promise<DebtDetailWithPayments> {
  const data = await apiRequest<DebtDetailResponse>(
    `/api/v1/debts/${debtId}`
  );
  return data.debt;
}

export async function createDebt(
  payload: CreateDebtPayload,
  idempotencyKey: string
): Promise<DebtWithPerson> {
  const data = await apiRequest<{ debt: DebtWithPerson }>("/api/v1/debts", {
    method: "POST",
    headers: writeHeaders(idempotencyKey),
    body: JSON.stringify(payload),
  });
  return data.debt;
}

export async function updateDebt(
  debtId: string,
  payload: UpdateDebtPayload
): Promise<Debt> {
  const data = await apiRequest<{ debt: Debt }>(`/api/v1/debts/${debtId}`, {
    method: "PATCH",
    headers: jsonHeaders(),
    body: JSON.stringify(payload),
  });
  return data.debt;
}

export function listDebtPaymentAccounts(): Promise<DebtPaymentAccountsResponse> {
  return apiRequest<DebtPaymentAccountsResponse>("/api/v1/accounts");
}

export async function previewDebtPayment(
  debtId: string,
  amount: number
): Promise<DebtPaymentPreview> {
  const data = await apiRequest<{ preview: DebtPaymentPreview }>(
    `/api/v1/debts/${debtId}/payments/preview`,
    {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ amount }),
    }
  );
  return data.preview;
}

export function createDebtPayment(
  debtId: string,
  payload: CreateDebtPaymentPayload,
  idempotencyKey: string
): Promise<DebtPaymentResponse> {
  return apiRequest<DebtPaymentResponse>(
    `/api/v1/debts/${debtId}/payments`,
    {
      method: "POST",
      headers: writeHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    }
  );
}

export async function closeDebt(
  debtId: string,
  reason: "paid" | "forgiven",
  idempotencyKey: string
): Promise<Debt> {
  const data = await apiRequest<{ debt: Debt }>(
    `/api/v1/debts/${debtId}/close`,
    {
      method: "POST",
      headers: writeHeaders(idempotencyKey),
      body: JSON.stringify({ reason }),
    }
  );
  return data.debt;
}

export async function reopenDebt(
  debtId: string,
  idempotencyKey: string
): Promise<Debt> {
  const data = await apiRequest<{ debt: Debt }>(
    `/api/v1/debts/${debtId}/reopen`,
    {
      method: "POST",
      headers: writeHeaders(idempotencyKey),
    }
  );
  return data.debt;
}

export async function rescheduleInstallment(
  debtId: string,
  installmentId: string,
  payload: { due_date: string; reason?: string | null },
  idempotencyKey: string
): Promise<DebtInstallment> {
  const data = await apiRequest<{ installment: DebtInstallment }>(
    `/api/v1/debts/${debtId}/installments/${installmentId}/reschedule`,
    {
      method: "POST",
      headers: writeHeaders(idempotencyKey),
      body: JSON.stringify(payload),
    }
  );
  return data.installment;
}

export async function skipInstallment(
  debtId: string,
  installmentId: string,
  reason: string,
  idempotencyKey: string
): Promise<DebtInstallment> {
  const data = await apiRequest<{ installment: DebtInstallment }>(
    `/api/v1/debts/${debtId}/installments/${installmentId}/skip`,
    {
      method: "POST",
      headers: writeHeaders(idempotencyKey),
      body: JSON.stringify({ reason }),
    }
  );
  return data.installment;
}

export function createClientIdempotencyKey(scope: string): string {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `dashboard:${scope}:${random}`;
}

async function apiRequest<T>(
  url: string,
  init: RequestInit = {}
): Promise<T> {
  const response = await fetch(url, {
    credentials: "same-origin",
    ...init,
  });
  const payload = (await response.json()) as ApiResponse<T>;
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

function jsonHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

function writeHeaders(idempotencyKey: string): HeadersInit {
  return {
    ...jsonHeaders(),
    "Idempotency-Key": idempotencyKey,
  };
}
