import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { resolveReportPeriodBounds } from "@/core/reports/report-engine";
import { getReportPeriod } from "@/data/repositories/reports.repository";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    periodo: z.enum(["semana", "quincena", "mes", "rango"]),
    valor: z.string().min(1),
    hasta: z.string().optional(),
  })
  .strict();

const MAX_RANGE_DAYS = 366;

// GET /reports/period (35 §10): agregado del periodo con desglose,
// exclusiones y referencias. RUL-REP-01: reutiliza la misma agregación que
// Presupuestos, nunca recalcula.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams.entries()));

    if (query.periodo === "rango" && !query.hasta) {
      return errorJson("VALIDATION_ERROR", "Falta la fecha de fin del rango.", meta, 400);
    }

    const { from, to } = resolveReportPeriodBounds(query.periodo, query.valor, query.hasta);

    if (to < from) {
      return errorJson("VALIDATION_ERROR", "La fecha de fin va antes que la de inicio.", meta, 400);
    }
    const days = Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
    if (days > MAX_RANGE_DAYS) {
      return errorJson("VALIDATION_ERROR", "Puedo mostrarte hasta un año a la vez. Para más, descarga el CSV.", meta, 400);
    }

    const period = await getReportPeriod(auth.client, auth.userId, { from, to });

    return okJson({ from, to, ...period }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
