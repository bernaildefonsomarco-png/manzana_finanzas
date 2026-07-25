import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, readJsonBody, unexpectedError, validationError } from "@/app/api/_lib/http";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import { recordInsightAction } from "@/data/repositories/insights.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z.object({
  action_key: z.string().trim().min(1).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({ actionKind: "experience_feedback", authenticatedSession: true, reversible: true });
    const insight = await recordInsightAction(createServiceClient(), auth.userId, id, {
      traceId: trace_id,
      actionKey: body.action_key,
      actionMetadata: body.metadata,
    });
    if (!insight) return errorJson("NOT_FOUND", "No encontre ese descubrimiento.", meta, 404);
    return okJson(
      {
        insight,
        note: "La interaccion quedo registrada. Cualquier cambio financiero usa su endpoint de dominio y el Core.",
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}
