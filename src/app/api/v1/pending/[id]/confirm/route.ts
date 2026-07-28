import { z } from "zod";
import { CoreError } from "@/core/finance/errors";
import {
  confirmPendingItemWithCore,
  PendingConfirmationValidationError,
  PendingDuplicateConfirmationRequiredError,
} from "@/core/pending/confirm-pending";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  PendingRepositoryError,
} from "@/data/repositories/pending.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  coreError,
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

const ConfirmPendingBodySchema = z
  .object({
    confirm_duplicate: z.boolean().optional(),
  })
  .strict();

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const body = ConfirmPendingBodySchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const serviceClient = createServiceClient();
    const result = await confirmPendingItemWithCore({
      client: serviceClient,
      userId: auth.userId,
      pendingItemId: params.id,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.pending.confirm",
      traceId: trace_id,
      confirmDuplicate: body.confirm_duplicate === true,
      channel: "dashboard",
    });

    return okJson(
      {
        pending_item: result.pendingItem,
        movement: result.movement,
        idempotent: result.idempotent,
        auto_resolved_duplicate: result.autoResolvedDuplicate,
      },
      meta,
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof PendingDuplicateConfirmationRequiredError) {
    return errorJson(
      "CONFLICT",
      error.message,
      meta,
      409,
      {
        reason: "cross_channel_duplicate",
        requires_confirmation: true,
        dedup_status: error.decision.status,
        matched_movement_id: error.decision.matched_reference_id,
        score: error.decision.score,
        pending_item_id: error.pendingItem.id,
      }
    );
  }

  if (error instanceof PendingConfirmationValidationError) {
    return errorJson("VALIDATION_ERROR", error.message, meta, 400);
  }

  if (error instanceof PendingRepositoryError) {
    if (error.code === "PENDING_ITEM_NOT_FOUND") {
      return errorJson("NOT_FOUND", "Pendiente no encontrado.", meta, 404);
    }

    if (error.code === "PENDING_ITEM_ALREADY_RESOLVED") {
      return errorJson("CONFLICT", "Este pendiente ya fue resuelto.", meta, 409);
    }

    return errorJson(
      "INTERNAL_ERROR",
      "No pude confirmar el pendiente.",
      meta,
      500
    );
  }

  if (error instanceof CoreError) return coreError(error, meta);
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
