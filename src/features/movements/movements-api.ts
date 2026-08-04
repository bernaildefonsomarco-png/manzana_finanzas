import type { CategoryId, Movement, MovementType } from "@/shared/types/domain";

export type ApiResponse<T> =
  | {
      ok: true;
      data: T;
      meta: { trace_id: string };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
      meta: { trace_id: string };
    };

export type CreateMovementPayload = {
  type: MovementType;
  amount: number;
  occurred_at: string;
  description: string | null;
  merchant: string | null;
  category_id: CategoryId | null;
  subcategory_id?: string | null;
  related_person_id?: string | null;
  tag_ids?: string[];
  requires_review?: boolean;
};

export type UpdateMovementPayload = Partial<
  Pick<
    CreateMovementPayload,
    | "type"
    | "amount"
    | "occurred_at"
    | "description"
    | "merchant"
    | "category_id"
    | "subcategory_id"
    | "related_person_id"
  >
>;

export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly traceId: string | null,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export async function listMovements(): Promise<Movement[]> {
  const response = await fetch("/api/v1/movements?limit=50", {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<{
    movements: Movement[];
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return payload.data.movements;
}

export type MovementsFilter = {
  type?: MovementType;
  from?: string;
  to?: string;
  category_id?: CategoryId;
  limit?: number;
};

/** Mismo filtro que `GET /api/v1/movements` — usado para reconstruir las
 * filas que componen un total ya agregado (procedencia, `48`), nunca para
 * recalcular el agregado. */
export async function listMovementsFiltered(filter: MovementsFilter): Promise<Movement[]> {
  const params = new URLSearchParams();
  if (filter.type) params.set("type", filter.type);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.category_id) params.set("category_id", filter.category_id);
  params.set("limit", String(filter.limit ?? 100));

  const response = await fetch(`/api/v1/movements?${params.toString()}`, {
    credentials: "same-origin",
  });

  const payload = (await response.json()) as ApiResponse<{ movements: Movement[] }>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null
    );
  }
  return payload.data.movements;
}

export async function createMovement(
  movement: CreateMovementPayload,
  options: { confirmDuplicate?: boolean } = {},
): Promise<Movement> {
  const response = await fetch("/api/v1/movements", {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify({
      ...movement,
      currency: "PEN",
      account_origin_id: null,
      account_destination_id: null,
      box_origin_id: null,
      box_destination_id: null,
      subcategory_id: movement.subcategory_id ?? null,
      debt_id: null,
      recurring_rule_id: null,
      related_person_id: movement.related_person_id ?? null,
      tag_ids: movement.tag_ids ?? [],
      confidence: null,
      confirm_duplicate: options.confirmDuplicate ?? false,
      metadata: {
        entry_surface: "dashboard",
      },
    }),
  });

  const payload = (await response.json()) as ApiResponse<{
    movement: Movement;
  }> | ApiResponse<{
    movement_created?: Movement;
    movement?: Movement;
  }>;

  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
      payload.error.details ?? {},
    );
  }

  const data = payload.data as {
    movement?: Movement;
    movement_created?: Movement;
  };
  const created = data.movement ?? data.movement_created;

  if (!created) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      "La API guardó el movimiento, pero no devolvió el registro.",
      response.status,
      payload.meta?.trace_id ?? null
    );
  }

  return created;
}

export async function updateMovement(
  movementId: string,
  patch: UpdateMovementPayload,
  reason: string,
): Promise<Movement> {
  return requestMovement(`/api/v1/movements/${movementId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ patch, reason }),
  });
}

export async function deleteMovement(
  movementId: string,
  reason: string,
): Promise<Movement> {
  return requestMovement(`/api/v1/movements/${movementId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "soft_delete", reason }),
  });
}

export async function restoreMovement(
  movementId: string,
  reason: string,
): Promise<Movement> {
  return requestMovement(`/api/v1/movements/${movementId}/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
}

async function requestMovement(
  url: string,
  init: RequestInit,
): Promise<Movement> {
  const response = await fetch(url, {
    ...init,
    credentials: "same-origin",
  });
  const payload = (await response.json()) as ApiResponse<{
    movement: Movement;
  }>;
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error.code,
      payload.error.message,
      response.status,
      payload.meta?.trace_id ?? null,
      payload.error.details ?? {},
    );
  }
  return payload.data.movement;
}
