import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { commitGoalOperation } from "@/data/repositories/budgets.repository";
import { budgetRouteError } from "../../budgets/operation-http";
import {
  EmptyGoalRequestSchema,
  LinkGoalBoxRequestSchema,
} from "../schemas";

const ParamsSchema = z.object({ id: z.string().uuid() });
type Context = { params: Promise<{ id: string }> };
type GoalAction =
  | "pause"
  | "resume"
  | "restore"
  | "link_box"
  | "unlink_box";

export function createGoalActionHandler(operation: GoalAction) {
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
          "Falta Idempotency-Key para cambiar la meta.",
          meta,
          400
        );
      }
      const { id } = ParamsSchema.parse(await context.params);
      const payload =
        operation === "link_box"
          ? LinkGoalBoxRequestSchema.parse(await readJsonBody(request))
          : EmptyGoalRequestSchema.parse(await readJsonBody(request));
      const result = await commitGoalOperation(auth.client, auth.userId, {
        operation,
        goalId: id,
        payload,
        idempotencyKey,
        traceId: meta.trace_id,
      });
      return okJson(
        { goal: result.goal },
        { ...meta, idempotent_replay: result.idempotent || undefined }
      );
    } catch (error) {
      return budgetRouteError(error, meta);
    }
  };
}
