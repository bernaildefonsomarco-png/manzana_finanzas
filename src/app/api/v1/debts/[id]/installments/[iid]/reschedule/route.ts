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
  DebtOperationError,
  getDebtById,
  getDebtInstallmentById,
  rescheduleDebtInstallment,
} from "@/data/repositories/debts.repository";
import { createServiceClient } from "@/data/supabase/server";
import { debtOperationErrorJson } from "../../../../operation-http";
import { RescheduleDebtInstallmentRequestSchema } from "../../../schemas";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({
  id: z.string().uuid(),
  iid: z.string().uuid(),
});
type RouteContext = { params: Promise<{ id: string; iid: string }> };

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
        "Falta Idempotency-Key para reprogramar la cuota.",
        meta,
        400
      );
    }
    const params = ParamsSchema.parse(await context.params);
    const parsed = RescheduleDebtInstallmentRequestSchema.parse(
      await readJsonBody(request)
    );
    const debt = await getDebtById(auth.client, auth.userId, params.id);
    if (!debt) {
      return errorJson("NOT_FOUND", "No encontre esa deuda.", meta, 404);
    }
    const installment = await getDebtInstallmentById(
      auth.client,
      auth.userId,
      debt.id,
      params.iid
    );
    if (!installment) {
      return errorJson("NOT_FOUND", "No encontre esa cuota.", meta, 404);
    }
    const result = await rescheduleDebtInstallment(createServiceClient(), {
      userId: auth.userId,
      installment,
      dueDate: parsed.due_date,
      reason: parsed.reason ?? null,
      idempotencyKey,
      traceId: trace_id,
    });
    return okJson(
      { installment: result.installment },
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
