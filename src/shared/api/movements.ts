import type { Movement } from "@/shared/types/domain";
import { ApiClientError, clientIdempotencyKey, parseApiResponse } from "./http-client";
import type {
  CreateDebtOriginationPayload,
  CreateDebtOriginationResult,
  CreateDebtPaymentPayload,
  CreateDebtPaymentResult,
  CreateGenericMovementPayload,
  CreateMovementResult,
  ListMovementsFilters,
  ListMovementsResponse,
  MovementHistoryResponse,
} from "./movements-types";

export { ApiClientError };
export * from "./movements-types";

function buildQuery(filters: ListMovementsFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

/** `SCR-MOV-01`: listado paginado por cursor, con todos los filtros de §8. */
export async function listMovements(
  filters: ListMovementsFilters = {},
): Promise<{ movements: Movement[]; page: { has_more: boolean; next_cursor: string | null } }> {
  const response = await fetch(`/api/v1/movements${buildQuery(filters)}`, {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    data?: ListMovementsResponse;
    meta?: { page?: { has_more: boolean; next_cursor: string | null } };
    error?: { code: string; message: string; details?: Record<string, unknown> };
  };
  if (!payload.ok || !payload.data) {
    throw new ApiClientError(
      payload.error?.code ?? "UNKNOWN",
      payload.error?.message ?? "No pude cargar los movimientos.",
      response.status,
      null,
      payload.error?.details ?? {},
    );
  }
  return {
    movements: payload.data.movements,
    page: payload.meta?.page ?? { has_more: false, next_cursor: null },
  };
}

/** `SCR-MOV-02`: detalle completo de un movimiento. */
export async function getMovement(id: string): Promise<Movement> {
  const response = await fetch(`/api/v1/movements/${id}`, { credentials: "same-origin" });
  const data = await parseApiResponse<{ movement: Movement }>(response);
  return data.movement;
}

/** `ACT-MOV-08`: historial de cambios (`26` §19 caso 12, paginado). */
export async function getMovementHistory(
  id: string,
  cursor?: string,
): Promise<MovementHistoryResponse & { page: { has_more: boolean; next_cursor: string | null } }> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/v1/movements/${id}/history${query}`, {
    credentials: "same-origin",
  });
  const payload = (await response.json()) as {
    ok: boolean;
    data?: MovementHistoryResponse;
    meta?: { page?: { has_more: boolean; next_cursor: string | null } };
    error?: { code: string; message: string };
  };
  if (!payload.ok || !payload.data) {
    throw new ApiClientError(
      payload.error?.code ?? "UNKNOWN",
      payload.error?.message ?? "No pude cargar el historial.",
      response.status,
      null,
    );
  }
  return { ...payload.data, page: payload.meta?.page ?? { has_more: false, next_cursor: null } };
}

async function postMovement<TResult>(
  body: Record<string, unknown>,
  action: string,
): Promise<TResult> {
  const response = await fetch("/api/v1/movements", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": clientIdempotencyKey(action),
    },
    body: JSON.stringify(body),
  });
  return parseApiResponse<TResult>(response);
}

/**
 * `WEB-D195`: gasto, ingreso, transferencia, asignacion_interna, ajuste y
 * pago_recurrente (sin ocurrencia) comparten esta ruta generica.
 */
export async function createMovement(
  payload: CreateGenericMovementPayload,
): Promise<CreateMovementResult> {
  return postMovement<CreateMovementResult>(payload, `movimiento:${payload.type}`);
}

/**
 * `WEB-D195`/`WEB-D198`: deuda_adquirida, prestamo_dado, prestamo_recibido
 * crean la deuda (y su movimiento vinculado si hay cuenta).
 */
export async function createDebtOriginationMovement(
  payload: CreateDebtOriginationPayload,
): Promise<CreateDebtOriginationResult> {
  return postMovement<CreateDebtOriginationResult>(payload, `movimiento:${payload.type}`);
}

/** `WEB-D195`: pago_deuda, devolucion_recibida exigen una deuda existente. */
export async function createDebtPaymentMovement(
  payload: CreateDebtPaymentPayload,
): Promise<CreateDebtPaymentResult> {
  return postMovement<CreateDebtPaymentResult>(payload, `movimiento:${payload.type}`);
}

export type MovementPatchPayload = Partial<{
  amount: number;
  currency: "PEN" | "USD";
  occurred_at: string;
  description: string | null;
  merchant: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  account_origin_id: string | null;
  account_destination_id: string | null;
  box_origin_id: string | null;
  box_destination_id: string | null;
  recurring_rule_id: string | null;
  related_person_id: string | null;
  metadata: Record<string, unknown>;
}>;

/** `ACT-MOV-02`/`RUL-MOV-05`: toda edicion queda en el historial. */
export async function updateMovement(
  id: string,
  patch: MovementPatchPayload,
  reason: string,
): Promise<{ movement: Movement }> {
  const response = await fetch(`/api/v1/movements/${id}`, {
    method: "PATCH",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch, reason }),
  });
  return parseApiResponse(response);
}

/** `ACT-MOV-04`/`RUL-MOV-06`: soft delete, reversible sin limite de tiempo. */
export async function deleteMovement(id: string, reason: string): Promise<{ movement: Movement }> {
  const response = await fetch(`/api/v1/movements/${id}`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "soft_delete", reason }),
  });
  return parseApiResponse(response);
}

/** `ACT-MOV-05`: restaura y recalcula el impacto. */
export async function restoreMovement(id: string, reason: string): Promise<{ movement: Movement }> {
  const response = await fetch(`/api/v1/movements/${id}/restore`, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return parseApiResponse(response);
}
