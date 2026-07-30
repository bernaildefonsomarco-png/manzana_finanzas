import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  getRecurringOccurrenceById,
  getRecurringRuleById,
  skipRecurringOccurrence,
} from "@/data/repositories/recurring.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  occurrence_id: z.string().uuid(),
});
type RouteContext = {
  params: Promise<{ id: string; occurrence_id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const recurringRule = await getRecurringRuleById(
      auth.client,
      auth.userId,
      params.id
    );
    if (!recurringRule) {
      return errorJson("NOT_FOUND", "No encontre ese pago recurrente.", meta, 404);
    }
    const occurrence = await getRecurringOccurrenceById(
      auth.client,
      auth.userId,
      params.occurrence_id
    );
    if (!occurrence || occurrence.recurring_rule_id !== recurringRule.id) {
      return errorJson("NOT_FOUND", "No encontre esa ocurrencia.", meta, 404);
    }
    if (["paid", "rejected"].includes(occurrence.status)) {
      return errorJson(
        "CONFLICT",
        "Esa ocurrencia ya no se puede omitir.",
        meta,
        409
      );
    }

    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const updated = await skipRecurringOccurrence(createServiceClient(), {
      userId: auth.userId,
      recurringRuleId: recurringRule.id,
      occurrenceId: occurrence.id,
      traceId: trace_id,
    });
    return okJson(
      {
        occurrence: updated.occurrence,
        recurring_rule: updated.recurring_rule,
        idempotent: updated.idempotent,
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
