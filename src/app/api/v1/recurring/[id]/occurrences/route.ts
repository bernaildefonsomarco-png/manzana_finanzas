import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  buildCursorOrFilter,
  clampLimit,
  decodeCursor,
  paginate,
} from "@/app/api/_lib/pagination";
import {
  getRecurringRuleById,
  listRecurringOccurrences,
} from "@/data/repositories/recurring.repository";
import { ListRecurringOccurrencesQuerySchema } from "../../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const query = ListRecurringOccurrencesQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const recurringRule = await getRecurringRuleById(
      auth.client,
      auth.userId,
      params.id
    );
    if (!recurringRule) {
      return errorJson("NOT_FOUND", "No encontre ese pago recurrente.", meta, 404);
    }

    const limit = clampLimit(query.limit);
    const occurrences = await listRecurringOccurrences(
      auth.client,
      auth.userId,
      params.id,
      {
        statuses: query.status,
        fromDate: query.from,
        toDate: query.to,
        limit: limit + 1,
        cursorFilter: cursor
          ? buildCursorOrFilter("expected_date", cursor, "desc")
          : undefined,
      }
    );
    const pageResult = paginate(
      occurrences,
      limit,
      (occurrence) => occurrence.expected_date
    );

    return okJson(
      { occurrences: pageResult.data },
      { ...meta, page: pageResult.page }
    );
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
