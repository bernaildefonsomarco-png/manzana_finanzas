import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { commitBudgetOperation } from "@/data/repositories/budgets.repository";
import { budgetRouteError } from "../operation-http";
import { EmptyObjectSchema } from "../schemas";

const ParamsSchema = z.object({ id: z.string().uuid() });
type Context = { params: Promise<{ id: string }> };
type BudgetAction = "pause" | "resume" | "restore";

export function createBudgetActionHandler(operation: BudgetAction) {
  return async function POST(request: Request, context: Context) {
    const meta = { trace_id: getTraceId(request) };
    try {
      const auth = await getApiAuth(request);
      if (!auth) {
        return errorJson(
          "AUTH_REQUIRED",
          "Necesitas iniciar sesion.",
          meta,
          401
        );
      }
      const idempotencyKey = readIdempotencyKey(request);
      if (!idempotencyKey) {
        return errorJson(
          "VALIDATION_ERROR",
          "Falta Idempotency-Key para cambiar el presupuesto.",
          meta,
          400
        );
      }
      const { id } = ParamsSchema.parse(await context.params);
      const payload = EmptyObjectSchema.parse(await readJsonBody(request));
      const result = await commitBudgetOperation(auth.client, auth.userId, {
        operation,
        budgetId: id,
        payload,
        idempotencyKey,
        traceId: meta.trace_id,
      });
      return okJson(
        { budget: result.budget },
        { ...meta, idempotent_replay: result.idempotent || undefined }
      );
    } catch (error) {
      return budgetRouteError(error, meta);
    }
  };
}
