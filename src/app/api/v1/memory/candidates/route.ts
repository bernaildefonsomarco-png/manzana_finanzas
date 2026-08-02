import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { listProfileCandidates } from "@/data/repositories/memory.repository";

const QuerySchema = z.object({ include_resolved: z.enum(["true", "false"]).default("false") }).strict();

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const candidates = await listProfileCandidates(auth.client, {
      userId: auth.userId,
      includeResolved: query.include_resolved === "true",
      limit: 1,
    });
    return okJson({ candidates }, meta, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
