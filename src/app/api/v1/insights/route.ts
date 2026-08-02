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
  listInsights,
  toPublicInsight,
} from "@/data/repositories/insights.repository";
import {
  buildCompositeCursorOrFilter,
  clampLimit,
  decodeCompositeCursor,
  paginateComposite,
} from "@/app/api/_lib/pagination";
import { INSIGHT_STATUSES, INSIGHT_TYPES } from "@/shared/types/domain";
import { getExperiencePreferences } from "@/data/repositories/experience-preferences.repository";

export const dynamic = "force-dynamic";

const INSIGHTS_ORDER_COLUMNS = ["rank_score", "created_at"];

const QuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().optional(),
    status: z.enum(INSIGHT_STATUSES).optional(),
    type: z.enum(INSIGHT_TYPES).optional(),
    cursor: z.string().optional(),
    include_expired: z.enum(["true", "false"]).optional(),
  })
  .strict();

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const cursor = decodeCompositeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = Math.min(clampLimit(query.limit), 5);

    const preferences = await getExperiencePreferences(auth.client, auth.userId);
    const insights = await listInsights(auth.client, auth.userId, {
      status: query.status,
      type: query.type,
      limit: limit + 1,
      cursorFilter: cursor
        ? buildCompositeCursorOrFilter(INSIGHTS_ORDER_COLUMNS, cursor, "desc")
        : undefined,
      includeExpired: query.include_expired === "true",
      excludeSensitive: preferences.discreet_mode_enabled,
    });

    const { data: pageRows, page } = paginateComposite(insights, limit, (row) => [
      String(row.rank_score),
      row.created_at,
    ]);

    return okJson(
      { insights: pageRows.map(toPublicInsight) },
      { ...meta, page },
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
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
