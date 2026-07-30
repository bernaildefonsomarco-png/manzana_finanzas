import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson } from "@/app/api/_lib/http";
import { listBudgetSuggestions } from "@/data/repositories/budgets.repository";
import { isoDateInLima } from "@/shared/dates/lima";
import { budgetRouteError } from "../operation-http";
import { BudgetPeriodSchema } from "../schemas";
import { z } from "zod";

export const dynamic = "force-dynamic";

const QuerySchema = z
  .object({
    period_kind: BudgetPeriodSchema.default("mensual"),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const query = QuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const suggestions = await listBudgetSuggestions(auth.client, auth.userId, {
      periodKind: query.period_kind,
      date: query.date ?? isoDateInLima(),
    });
    return okJson({ suggestions }, meta);
  } catch (error) {
    return budgetRouteError(error, meta);
  }
}
