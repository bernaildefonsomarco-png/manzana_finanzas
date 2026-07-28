import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
} from "@/app/api/_lib/http";
import { listDebtInstallmentCommitments } from "@/data/repositories/debts.repository";
import {
  listRecurringDashboard,
  sortRecurringRulesByNextExpectedDate,
} from "@/data/repositories/recurring.repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const [recurring, debt_installments] = await Promise.all([
      listRecurringDashboard(auth.client, auth.userId),
      listDebtInstallmentCommitments(auth.client, auth.userId),
    ]);

    return okJson(
      {
        ...recurring,
        rules: sortRecurringRulesByNextExpectedDate(recurring.rules),
        debt_installments,
      },
      meta
    );
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
