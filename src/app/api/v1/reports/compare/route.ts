import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { compareReportPeriods, resolveReportPeriodBounds } from "@/core/reports/report-engine";
import { getReportPeriod } from "@/data/repositories/reports.repository";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    periodo: z.enum(["semana", "quincena", "mes"]),
    valor: z.string().min(1),
    comparar: z.string().min(1),
  })
  .strict();

// GET /reports/compare (35 §10, RUL-REP-04): dos periodos equivalentes.
// Solo mes-con-mes, semana-con-semana, quincena-con-quincena.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    const current = resolveReportPeriodBounds(query.periodo, query.valor);
    const previous = resolveReportPeriodBounds(query.periodo, query.comparar);

    const [currentPeriod, previousPeriod] = await Promise.all([
      getReportPeriod(auth.client, auth.userId, current),
      getReportPeriod(auth.client, auth.userId, previous),
    ]);

    const currentDays = daysBetween(current.from, current.to);
    const previousDays = daysBetween(previous.from, previous.to);

    return okJson(
      {
        current: { ...current, ...currentPeriod, days: currentDays },
        previous: { ...previous, ...previousPeriod, days: previousDays },
        comparison: compareReportPeriods(currentPeriod, previousPeriod),
        different_length: currentDays !== previousDays,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function daysBetween(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000) + 1;
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
