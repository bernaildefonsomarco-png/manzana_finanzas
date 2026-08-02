import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { parseSearchQuery } from "@/core/search/query-parser";
import { matchPalette, searchAll } from "@/data/repositories/search.repository";

export const dynamic = "force-dynamic";
const QuerySchema = z.object({ q: z.string().max(200).optional() }).strict();

// GET /search/palette (38 §10, RUL-BUS-06): reducida y rápida — menos
// entidades, límites más bajos, presupuesto de latencia propio (150ms).
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const { q } = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const rawQuery = q ?? "";

    if (rawQuery.length < 2) {
      const { destinations, actions } = matchPalette("");
      return okJson({ ir_a: destinations.slice(0, 6), hacer: actions, encontrar: [] }, meta);
    }

    const parsed = parseSearchQuery(rawQuery);
    const { destinations, actions } = matchPalette(parsed.freeText);
    const results = parsed.isQuestion
      ? null
      : await searchAll(auth.client, auth.userId, parsed, 5);

    return okJson(
      {
        ir_a: destinations,
        hacer: actions,
        encontrar: results
          ? {
              movements: results.movements,
              accounts: results.accounts,
              categories: results.categories,
              debts: results.debts,
              commitments: results.commitments,
            }
          : null,
        is_question: parsed.isQuestion,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
