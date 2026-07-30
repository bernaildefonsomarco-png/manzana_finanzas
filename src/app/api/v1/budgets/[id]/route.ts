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
  commitBudgetOperation,
  getBudgetDetail,
} from "@/data/repositories/budgets.repository";
import { budgetRouteError } from "../operation-http";
import { EmptyObjectSchema, UpdateBudgetRequestSchema } from "../schemas";

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
    const budget = await getBudgetDetail(auth.client, auth.userId, id);
    if (!budget) {
      return errorJson(
        "NOT_FOUND",
        "No encontre ese presupuesto.",
        meta,
        404
      );
    }
    return okJson({ budget }, meta);
  } catch (error) {
    return budgetRouteError(error, meta);
  }
}

export async function PATCH(request: Request, context: Context) {
  return mutateBudget(request, context, "update", UpdateBudgetRequestSchema);
}

export async function DELETE(request: Request, context: Context) {
  return mutateBudget(request, context, "archive", EmptyObjectSchema);
}

async function mutateBudget(
  request: Request,
  context: Context,
  operation: "update" | "archive",
  schema: typeof UpdateBudgetRequestSchema | typeof EmptyObjectSchema
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
        "Falta Idempotency-Key para modificar el presupuesto.",
        meta,
        400
      );
    }
    const { id } = ParamsSchema.parse(await context.params);
    const payload =
      operation === "archive"
        ? EmptyObjectSchema.parse({})
        : schema.parse(await readJsonBody(request));
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
}
