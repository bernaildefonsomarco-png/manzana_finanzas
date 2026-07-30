import { z } from "zod";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  getPendingItemById,
  markPendingAlreadyRegistered,
  PendingRepositoryError,
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
import { AlreadyRegisteredRequestSchema } from "../../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

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
    const body = AlreadyRegisteredRequestSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });

    const serviceClient = createServiceClient();
    const current = await getPendingItemById(serviceClient, auth.userId, params.id);
    if (!current) {
      return errorJson("NOT_FOUND", "Pendiente no encontrado.", meta, 404);
    }

    // RUL-PEND-06: si ya se detecto un duplicado candidato al abrir el
    // pendiente, se enlaza sin que el usuario tenga que volver a buscarlo.
    const detectedMatch =
      typeof current.metadata.dedup_matched_reference_id === "string"
        ? current.metadata.dedup_matched_reference_id
        : null;
    const linkedMovementId = body.movement_id ?? detectedMatch ?? null;

    const pendingItem = await markPendingAlreadyRegistered(
      serviceClient,
      auth.userId,
      params.id,
      auth.userId,
      linkedMovementId,
      trace_id
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
      "No pude marcar el pendiente como ya registrado.",
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
