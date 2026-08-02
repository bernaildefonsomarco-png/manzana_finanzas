import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { getInsightEvidence } from "@/data/repositories/insights.repository";
import { getInsightById } from "@/data/repositories/insights.repository";
import { getExperiencePreferences } from "@/data/repositories/experience-preferences.repository";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    const { id } = ParamsSchema.parse(await context.params);
    const [detail, preferences] = await Promise.all([
      getInsightById(auth.client, auth.userId, id),
      getExperiencePreferences(auth.client, auth.userId),
    ]);
    if (!detail || (preferences.discreet_mode_enabled && detail.insight.risk_level === "sensitive")) {
      return errorJson("NOT_FOUND", "No encontre ese descubrimiento.", meta, 404);
    }
    const evidence = await getInsightEvidence(auth.client, auth.userId, id);
    if (!evidence) return errorJson("NOT_FOUND", "No encontre ese descubrimiento.", meta, 404);
    return okJson({ evidence }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}
