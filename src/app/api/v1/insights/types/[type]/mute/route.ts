import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { InsightOperationError, setInsightTypeMuted } from "@/data/repositories/insights.repository";
import { INSIGHT_TYPES } from "@/shared/types/domain";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ type: z.enum(INSIGHT_TYPES) });
type RouteContext = { params: Promise<{ type: string }> };

export async function POST(request: Request, context: RouteContext) {
  return setMuted(request, context, true);
}

export async function setMuted(request: Request, context: RouteContext, muted: boolean) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { type } = ParamsSchema.parse(await context.params);
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key para guardar la preferencia.", meta, 400);
    const result = await setInsightTypeMuted(auth.client, auth.userId, {
      type,
      muted,
      idempotencyKey,
      traceId: trace_id,
    });
    return okJson(
      { type, muted, preference: result.preference },
      { ...meta, ...(result.idempotent ? { idempotent_replay: true } : {}) },
    );
  } catch (error) {
    if (error instanceof InsightOperationError) return errorJson("CONFLICT", "Esa Idempotency-Key ya se uso con otros datos.", meta, 409);
    if (error && typeof error === "object" && "issues" in error) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
