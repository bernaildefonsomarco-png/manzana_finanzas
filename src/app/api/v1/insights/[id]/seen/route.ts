import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import { commitInsightInteraction, InsightOperationError, toPublicInsight } from "@/data/repositories/insights.repository";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ParamsSchema.parse(await context.params);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key para marcarlo como visto.", meta, 400);
    }
    assertSystemActionAllowed({
      actionKind: "experience_feedback",
      authenticatedSession: true,
      reversible: true,
    });
    const result = await commitInsightInteraction(auth.client, auth.userId, {
      insightId: id,
      operation: "seen",
      idempotencyKey,
      traceId: trace_id,
    });
    if (!result) return errorJson("NOT_FOUND", "No encontre ese descubrimiento.", meta, 404);
    return okJson(
      { insight: toPublicInsight(result.insight) },
      { ...meta, ...(result.idempotent ? { idempotent_replay: true } : {}) },
    );
  } catch (error) {
    if (error instanceof InsightOperationError) return errorJson("CONFLICT", "Esa Idempotency-Key ya se uso con otros datos.", meta, 409);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}
