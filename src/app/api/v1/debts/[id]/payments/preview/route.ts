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
import {
  DebtOperationError,
  getDebtById,
  listDebtInstallmentsForDebt,
  previewDebtPaymentAllocation,
} from "@/data/repositories/debts.repository";
import { debtOperationErrorJson } from "../../../operation-http";
import { DebtPaymentPreviewRequestSchema } from "../schemas";

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
    const params = ParamsSchema.parse(await context.params);
    const parsed = DebtPaymentPreviewRequestSchema.parse(
      await readJsonBody(request)
    );
    const debt = await getDebtById(auth.client, auth.userId, params.id);
    if (!debt) {
      return errorJson("NOT_FOUND", "No encontre esa deuda.", meta, 404);
    }
    const installments = await listDebtInstallmentsForDebt(
      auth.client,
      auth.userId,
      debt.id
    );
    const preview = previewDebtPaymentAllocation({
      amount: parsed.amount,
      currentBalance: Number(debt.current_balance),
      installments,
    });
    return okJson({ preview }, meta);
  } catch (error) {
    if (error instanceof DebtOperationError) {
      return debtOperationErrorJson(error, meta);
    }
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
