import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import {
  commitGoalOperation,
  getGoalDetail,
} from "@/data/repositories/budgets.repository";
import { isoDateInLima } from "@/shared/dates/lima";
import { budgetRouteError } from "../../budgets/operation-http";
import {
  EmptyGoalRequestSchema,
  UpdateGoalRequestSchema,
} from "../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });
type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const { id } = ParamsSchema.parse(await context.params);
    const goal = await getGoalDetail(
      auth.client,
      auth.userId,
      id,
      isoDateInLima()
    );
    if (!goal) {
      return errorJson("NOT_FOUND", "No encontre esa meta.", meta, 404);
    }
    return okJson({ goal }, meta);
  } catch (error) {
    return budgetRouteError(error, meta);
  }
}

export async function PATCH(request: Request, context: Context) {
  return mutateGoal(request, context, "update");
}

export async function DELETE(request: Request, context: Context) {
  return mutateGoal(request, context, "archive");
}

async function mutateGoal(
  request: Request,
  context: Context,
  operation: "update" | "archive"
) {
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
        "Falta Idempotency-Key para modificar la meta.",
        meta,
        400
      );
    }
    const { id } = ParamsSchema.parse(await context.params);
    const payload =
      operation === "archive"
        ? EmptyGoalRequestSchema.parse({})
        : UpdateGoalRequestSchema.parse(await readJsonBody(request));
    if (
      "target_date" in payload &&
      payload.target_date &&
      payload.target_date <= isoDateInLima()
    ) {
      return errorJson(
        "VALIDATION_ERROR",
        "La fecha objetivo tiene que ser futura.",
        meta,
        400
      );
    }
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
}
