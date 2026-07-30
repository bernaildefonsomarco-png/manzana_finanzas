import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  ProjectionInputError,
  simulateProjectionExpense,
} from "@/data/repositories/projections.repository";
import { presentExpenseSimulation } from "../projections/presenter";
import { SimulateExpenseRequestSchema } from "../projections/schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const input = SimulateExpenseRequestSchema.parse(
      await readJsonBody(request)
    );
    const result = await simulateProjectionExpense(
      auth.client,
      auth.userId,
      {
        amount: input.amount,
        categoryId: input.category_id,
        date: input.date,
      }
    );
    return okJson(
      {
        available: result.has_pen_accounts,
        reason: result.has_pen_accounts ? null : "no_balance_data",
        simulation: presentExpenseSimulation(result.simulation),
        budget_effect: result.budget_effect,
      },
      meta
    );
  } catch (error) {
    if (error instanceof ProjectionInputError) {
      return errorJson("VALIDATION_ERROR", error.message, meta, 400, {
        reason: error.code,
      });
    }
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
