import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { suggestSpelling } from "@/core/search/spelling-suggestion";

export const dynamic = "force-dynamic";
const QuerySchema = z.object({ q: z.string().min(1).max(200) }).strict();

// GET /search/suggest (38 §10): corrección ortográfica sobre los comercios
// del usuario, nunca sobre un diccionario general.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const { q } = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const { data, error } = await auth.client
      .from("movements")
      .select("merchant")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .not("merchant", "is", null)
      .limit(500);
    if (error) throw error;

    const merchants = [...new Set(((data ?? []) as { merchant: string | null }[]).map((r) => r.merchant).filter((m): m is string => Boolean(m)))];
    const suggestion = suggestSpelling(q, merchants);

    return okJson({ suggestion }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
