import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { clampLimit } from "@/app/api/_lib/pagination";
import { listRecurringCandidates } from "@/data/repositories/recurring.repository";
import { ListRecurringCandidatesQuerySchema } from "../schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const query = ListRecurringCandidatesQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const candidates = await listRecurringCandidates(
      auth.client,
      auth.userId,
      query.status,
      { limit: clampLimit(query.limit) }
    );
    return okJson({ candidates }, meta);
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
