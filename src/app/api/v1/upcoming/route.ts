import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { COMMITMENT_HORIZON_DAYS } from "@/core/finance/money-layers";
import { mergeUpcomingCommitments } from "@/core/recurring/upcoming-commitments";
import { listDebtInstallmentCommitments } from "@/data/repositories/debts.repository";
import {
  listRecurringDashboard,
  listUpcomingCommitments,
  sortRecurringRulesByNextExpectedDate,
} from "@/data/repositories/recurring.repository";

export const dynamic = "force-dynamic";

const UpcomingQuerySchema = z.object({}).strict();

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    UpcomingQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );

    const [recurring, recurringCommitments, debtCommitments] =
      await Promise.all([
        listRecurringDashboard(auth.client, auth.userId),
        listUpcomingCommitments(
          auth.client,
          auth.userId,
          COMMITMENT_HORIZON_DAYS
        ),
        listDebtInstallmentCommitments(
          auth.client,
          auth.userId,
          COMMITMENT_HORIZON_DAYS
        ),
      ]);
    const recurringRules = recurring.rules.filter(
      (rule) => !rule.linked_debt_id
    );

    return okJson(
      {
        commitments: mergeUpcomingCommitments(
          recurringCommitments,
          debtCommitments
        ),
        recurring_rules: sortRecurringRulesByNextExpectedDate(recurringRules),
        candidates: recurring.candidates,
        horizon_days: COMMITMENT_HORIZON_DAYS,
        timezone: "America/Lima",
      },
      meta
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
