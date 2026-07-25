import { createServiceClient } from "@/data/supabase/server";
import { runRecurringCandidateDetection } from "@/data/repositories/recurring.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { DetectRecurringCandidatesRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const body = await readJsonBody(request);
    const parsed = DetectRecurringCandidatesRequestSchema.parse(body);
    const serviceClient = createServiceClient();
    const result = await runRecurringCandidateDetection(serviceClient, auth.userId, {
      lookbackDays: parsed.lookback_days,
      limit: parsed.limit,
      traceId: trace_id,
    });

    return okJson({ result }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
