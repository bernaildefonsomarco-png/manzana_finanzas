import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { parseSearchQuery, validateDateRange } from "@/core/search/query-parser";
import { searchAll } from "@/data/repositories/search.repository";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    q: z.string().max(200).optional(),
  })
  .strict();

// GET /search (38 §10): global, agrupado por entidad. Ninguna respuesta
// incluye puntuación, relevancia ni confianza (RUL-BUS-02, AC-BUS-01).
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const { q } = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const rawQuery = q ?? "";

    const parsed = parseSearchQuery(rawQuery);

    if (parsed.isQuestion) {
      return okJson(
        {
          is_question: true,
          query: parsed.freeText,
          results: null,
        },
        meta,
      );
    }

    if (parsed.dateRange) {
      const validation = validateDateRange(parsed.dateRange.from, parsed.dateRange.to);
      if (!validation.valid) {
        return errorJson(
          "VALIDATION_ERROR",
          validation.error === "invalid_order"
            ? "Esa fecha de fin va antes que la de inicio."
            : "Puedo buscar en un año a la vez.",
          meta,
          400,
        );
      }
    }

    const results = await searchAll(auth.client, auth.userId, parsed);

    return okJson(
      {
        is_question: false,
        filters: {
          text: parsed.freeText || null,
          amount: parsed.amount,
          date_range: parsed.dateRange,
        },
        results,
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
