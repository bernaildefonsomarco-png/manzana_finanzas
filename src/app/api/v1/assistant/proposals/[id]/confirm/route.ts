import { z } from "zod";
import { CoreError } from "@/core/finance/errors";
import {
  confirmPendingItemWithCore,
  PendingConfirmationValidationError,
  PendingDuplicateConfirmationRequiredError,
} from "@/core/pending/confirm-pending";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  getPendingItemById,
  isTerminalPendingStatus,
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
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

const ConfirmBodySchema = z
  .object({
    confirm_duplicate: z.boolean().optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

/**
 * `ACT-ASI-04`/`AC-ASI-03`: la unica accion del asistente que escribe.
 * `[id]` es hoy siempre un `pending_item_id` (`WEB-D263`, `WEB-D265`) —
 * mismo camino que `POST /pending/[id]/confirm`, con la misma clave de
 * idempotencia obligatoria y el mismo cliente de servicio justificado por
 * la misma razon: el envio ya viene autenticado y validado, ejecutar es
 * trabajo del Core, no del canal (`41` S14).
 */
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para confirmar la propuesta.",
        meta,
        400
      );
    }

    const params = ParamsSchema.parse(await context.params);
    const body = ConfirmBodySchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const serviceClient = createServiceClient();

    const currentPending = await getPendingItemById(
      serviceClient,
      auth.userId,
      params.id
    );
    if (!currentPending) {
      return errorJson("NOT_FOUND", "Esa propuesta ya no esta.", meta, 404);
    }
    if (
      !isTerminalPendingStatus(currentPending.status) &&
      !currentPending.confirmable
    ) {
      return errorJson(
        "CORE_REJECTED",
        "Me falta un dato para poder registrarlo.",
        meta,
        422,
        { reason: "not_confirmable", missing_fields: currentPending.metadata.missing_fields ?? [] }
      );
    }

    const result = await confirmPendingItemWithCore({
      client: serviceClient,
      userId: auth.userId,
      pendingItemId: params.id,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.assistant.proposals.confirm",
      traceId: trace_id,
      confirmDuplicate: body.confirm_duplicate === true,
      channel: "dashboard",
    });

    return okJson(
      {
        proposal: result.pendingItem,
        movement: result.movement,
        idempotent: result.idempotent,
        auto_resolved_duplicate: result.autoResolvedDuplicate,
      },
      { ...meta, idempotent_replay: result.idempotent || undefined },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof PendingDuplicateConfirmationRequiredError) {
    return errorJson("CONFLICT", error.message, meta, 409, {
      reason: "cross_channel_duplicate",
      requires_confirmation: true,
      dedup_status: error.decision.status,
      matched_movement_id: error.decision.matched_reference_id,
      score: error.decision.score,
      pending_item_id: error.pendingItem.id,
    });
  }
  if (error instanceof PendingConfirmationValidationError) {
    return errorJson("VALIDATION_ERROR", error.message, meta, 400);
  }
  if (error instanceof PendingRepositoryError) {
    if (error.code === "PENDING_ITEM_NOT_FOUND") {
      return errorJson("NOT_FOUND", "Esa propuesta ya no esta.", meta, 404);
    }
    if (error.code === "PENDING_ITEM_ALREADY_RESOLVED") {
      return errorJson("CONFLICT", "Esa propuesta ya se resolvio.", meta, 409);
    }
    return errorJson("INTERNAL_ERROR", "No pude confirmar la propuesta.", meta, 500);
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
