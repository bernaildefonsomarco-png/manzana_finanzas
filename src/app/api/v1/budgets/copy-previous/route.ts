import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { commitBudgetOperation } from "@/data/repositories/budgets.repository";
import { isoDateInLima } from "@/shared/dates/lima";
import { budgetRouteError } from "../operation-http";
import { CopyPreviousBudgetRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para copiar presupuestos.",
        meta,
        400
      );
    }
    const input = CopyPreviousBudgetRequestSchema.parse(
      await readJsonBody(request)
    );
    const result = await commitBudgetOperation(auth.client, auth.userId, {
      operation: "copy_previous",
      budgetId: null,
      payload: { ...input, date: input.date ?? isoDateInLima() },
      idempotencyKey,
      traceId: meta.trace_id,
    });
    return okJson(
      { budgets: result.budgets ?? (result.budget ? [result.budget] : []) },
      { ...meta, idempotent_replay: result.idempotent || undefined },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    return budgetRouteError(error, meta);
  }
}
