import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  clampLimit,
  decodeCursor,
  paginateInMemory,
} from "@/app/api/_lib/pagination";
import {
  getCategoryTotalsForCurrentPeriod,
  getClassificationCatalog,
} from "@/data/repositories/classification.repository";
import { ListClassificationQuerySchema } from "../classification/schemas";
import { isZodLike } from "../classification/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const query = ListClassificationQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const [catalog, totals] = await Promise.all([
      getClassificationCatalog(auth.client, auth.userId),
      getCategoryTotalsForCurrentPeriod(auth.client, auth.userId),
    ]);
    const totalsByCategory = new Map(
      totals
        .filter((row) => row.category_id !== null)
        .map((row) => [row.category_id, row])
    );
    const unclassified = totals.find((row) => row.category_id === null) ?? {
      category_id: null,
      total: 0,
      movement_count: 0,
    };

    const categoriesWithTotals = catalog.categories.map((category) => {
      const total = totalsByCategory.get(category.id);
      return {
        ...category,
        total_this_period: total?.total ?? 0,
        movement_count_this_period: total?.movement_count ?? 0,
      };
    });

    const { data: pageRows, page } = paginateInMemory(
      categoriesWithTotals,
      limit,
      cursor
    );

    return okJson(
      {
        categories: pageRows,
        // AC-CAT-01: sin_clasificar nunca se mezcla con "otros".
        unclassified: {
          total: unclassified.total,
          movement_count: unclassified.movement_count,
        },
      },
      { ...meta, page }
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

