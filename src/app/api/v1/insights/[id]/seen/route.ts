import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import { recordInsightSeen } from "@/data/repositories/insights.repository";
import { createServiceClient } from "@/data/supabase/server";

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
    assertSystemActionAllowed({
      actionKind: "experience_feedback",
      authenticatedSession: true,
      reversible: true,
    });
    const insight = await recordInsightSeen(createServiceClient(), auth.userId, id, {
      traceId: trace_id,
    });
    if (!insight) return errorJson("NOT_FOUND", "No encontre ese descubrimiento.", meta, 404);
    return okJson({ insight }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}
