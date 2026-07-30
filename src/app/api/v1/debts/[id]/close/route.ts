import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import {
  closeDebt,
  DebtOperationError,
  getDebtById,
} from "@/data/repositories/debts.repository";
import { createServiceClient } from "@/data/supabase/server";
import { debtOperationErrorJson } from "../../operation-http";
import { CloseDebtRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para cerrar la deuda.",
        meta,
        400
      );
    }
    const params = ParamsSchema.parse(await context.params);
    const parsed = CloseDebtRequestSchema.parse(await readJsonBody(request));
    const debt = await getDebtById(auth.client, auth.userId, params.id);
    if (!debt) {
      return errorJson("NOT_FOUND", "No encontre esa deuda.", meta, 404);
    }
    const result = await closeDebt(createServiceClient(), {
      userId: auth.userId,
      debt,
      reason: parsed.reason,
      idempotencyKey,
      traceId: trace_id,
    });
    return okJson(
      { debt: result.debt },
      { ...meta, idempotent_replay: result.idempotent || undefined }
    );
  } catch (error) {
    if (error instanceof DebtOperationError) {
      return debtOperationErrorJson(error, meta);
    }
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
