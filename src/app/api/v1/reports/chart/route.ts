import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { resolveReportPeriodBounds, topCategoriesWithOthers } from "@/core/reports/report-engine";
import { getReportPeriod } from "@/data/repositories/reports.repository";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    periodo: z.enum(["semana", "quincena", "mes", "rango"]),
    valor: z.string().min(1),
    hasta: z.string().optional(),
  })
  .strict();

// GET /reports/chart (35 §10, RUL-REP-06): el gráfico y su tabla en la
// misma respuesta — nunca dos peticiones que puedan divergir.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));
    const { from, to } = resolveReportPeriodBounds(query.periodo, query.valor, query.hasta);

    const period = await getReportPeriod(auth.client, auth.userId, { from, to });
    const { top, othersTotal, othersCount } = topCategoriesWithOthers(period.byCategory);

    const bars = [
      ...top.map((c) => ({ category_id: c.category_id, total: c.total, movement_count: c.movement_count })),
      ...(othersCount > 0 ? [{ category_id: null, total: othersTotal, movement_count: othersCount, is_others: true }] : []),
    ];

    return okJson(
      {
        from,
        to,
        chart: "barras_categoria",
        bars,
        table: period.byCategory,
        has_ingresos: period.ingresoTotal > 0,
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
