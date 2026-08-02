import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import {
  listInsightSummary,
  toPublicInsight,
} from "@/data/repositories/insights.repository";

export const dynamic = "force-dynamic";
const QuerySchema = z.object({}).strict();

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const insights = await listInsightSummary(auth.client, auth.userId);
    return okJson({ insights: insights.map(toPublicInsight) }, meta);
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
