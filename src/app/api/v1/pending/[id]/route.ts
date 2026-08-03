import { z } from "zod";
import { computeConfirmability } from "@/core/pending/compute-confirmability";
import { mergeProposedAction } from "@/core/pending/merge-proposed-action";
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

    const mergedSummary = {
      ...current.normalized_summary,
      ...parsed.normalized_summary,
    };
    const mergedAction = parsed.proposed_action
      ? mergeProposedAction(current.proposed_action, parsed.proposed_action)
      : current.proposed_action;
    // RUL-PEND-01: completar datos puede volver confirmable un pendiente
    // que no lo era (SCR-PEND-04) — se recalcula en cada edicion, nunca se
    // hereda el valor anterior.
    const confirmability = await computeConfirmability({
      client: serviceClient,
      userId: auth.userId,
      proposedAction: mergedAction,
      normalizedSummary: mergedSummary,
    });
    const pendingItem = await updatePendingSummary(
      serviceClient,
      auth.userId,
      params.id,
      mergedSummary,
      trace_id,
      parsed.proposed_action ? mergedAction : undefined,
      {
        confirmable: confirmability.confirmable,
        confirmCommand: confirmability.confirmCommand,
        missingFields: confirmability.missingFields,
      },
    );

    return okJson({ pending_item: pendingItem }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
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
