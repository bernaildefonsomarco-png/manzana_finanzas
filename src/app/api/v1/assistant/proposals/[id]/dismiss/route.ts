import { z } from "zod";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  markPendingDiscarded,
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
import { DiscardPendingRequestSchema } from "../../../../pending/schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

type RouteContext = { params: Promise<{ id: string }> };

/** `ACT-ASI-05`: descartar una propuesta no requiere justificacion del usuario. */
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const parsed = DiscardPendingRequestSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });

    const proposal = await markPendingDiscarded(
      createServiceClient(),
      auth.userId,
      params.id,
      parsed.reason,
      auth.userId,
      trace_id
    );

    return okJson({ proposal }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof PendingRepositoryError) {
    if (error.code === "PENDING_ITEM_NOT_FOUND") {
      return errorJson("NOT_FOUND", "Esa propuesta ya no esta.", meta, 404);
    }
    if (error.code === "PENDING_ITEM_ALREADY_RESOLVED") {
      return errorJson("CONFLICT", "Esa propuesta ya se resolvio.", meta, 409);
    }
    return errorJson("INTERNAL_ERROR", "No pude descartar la propuesta.", meta, 500);
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
