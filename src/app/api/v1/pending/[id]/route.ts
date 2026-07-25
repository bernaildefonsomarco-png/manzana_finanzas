import { z } from "zod";
import {
  getPendingItemById,
  PendingRepositoryError,
  updatePendingSummary,
} from "@/data/repositories/pending.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { UpdatePendingRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const pendingItem = await getPendingItemById(
      auth.client,
      auth.userId,
      params.id
    );

    if (!pendingItem) {
      return errorJson("NOT_FOUND", "Pendiente no encontrado.", meta, 404);
    }

    return okJson({ pending_item: pendingItem }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const body = await readJsonBody(request);
    const parsed = UpdatePendingRequestSchema.parse(body);
    const serviceClient = createServiceClient();
    const current = await getPendingItemById(
      serviceClient,
      auth.userId,
      params.id
    );

    if (!current) {
      return errorJson("NOT_FOUND", "Pendiente no encontrado.", meta, 404);
    }

    const pendingItem = await updatePendingSummary(
      serviceClient,
      auth.userId,
      params.id,
      {
        ...current.normalized_summary,
        ...parsed.normalized_summary,
      },
      trace_id,
      parsed.proposed_action
        ? mergeProposedAction(current.proposed_action, parsed.proposed_action)
        : undefined,
    );

    return okJson({ pending_item: pendingItem }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function mergeProposedAction(
  current: Record<string, unknown>,
  patch: {
    action?: string;
    account_id?: string | null;
    account_origin_id?: string | null;
    account_destination_id?: string | null;
    debt_id?: string | null;
    recurring_rule_id?: string | null;
    recurring_occurrence_id?: string | null;
  },
): Record<string, unknown> {
  const action = patch.action ?? readString(current.action) ?? "create_movement";
  const movementInput =
    current.movement_input &&
    typeof current.movement_input === "object" &&
    !Array.isArray(current.movement_input)
      ? { ...(current.movement_input as Record<string, unknown>) }
      : {};
  if (action === "record_transfer") {
    movementInput.type = "transferencia";
    movementInput.account_origin_id = patch.account_origin_id ?? null;
    movementInput.account_destination_id =
      patch.account_destination_id ?? null;
  } else if (action === "record_debt_payment") {
    movementInput.type = "pago_deuda";
    movementInput.debt_id = patch.debt_id ?? null;
    movementInput.account_origin_id = patch.account_id ?? null;
  } else if (action === "record_recurring_payment") {
    movementInput.type = "pago_recurrente";
    movementInput.recurring_rule_id = patch.recurring_rule_id ?? null;
    movementInput.recurring_occurrence_id =
      patch.recurring_occurrence_id ?? null;
    movementInput.account_origin_id = patch.account_id ?? null;
  }
  return {
    ...current,
    ...patch,
    action,
    movement_input: movementInput,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof PendingRepositoryError) {
    if (error.code === "PENDING_ITEM_NOT_FOUND") {
      return errorJson("NOT_FOUND", "Pendiente no encontrado.", meta, 404);
    }

    if (error.code === "PENDING_ITEM_ALREADY_RESOLVED") {
      return errorJson("CONFLICT", "Este pendiente ya fue resuelto.", meta, 409);
    }

    return errorJson(
      "INTERNAL_ERROR",
      "No pude actualizar el pendiente.",
      meta,
      500
    );
  }

  if (isZodLike(error)) return validationError(error, meta);
  return unexpectedError(error, meta);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
