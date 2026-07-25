import { z } from "zod";
import { createServiceClient } from "@/data/supabase/server";
import {
  getRecurringRuleById,
  updateRecurringRule,
} from "@/data/repositories/recurring.repository";
import { getAccountById } from "@/data/repositories/accounts.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { UpdateRecurringRuleRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const recurring_rule = await getRecurringRuleById(
      auth.client,
      auth.userId,
      params.id
    );

    if (!recurring_rule) {
      return errorJson("NOT_FOUND", "No encontre ese pago recurrente.", meta, 404);
    }

    return okJson({ recurring_rule }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const existing = await getRecurringRuleById(auth.client, auth.userId, params.id);
    if (!existing) {
      return errorJson("NOT_FOUND", "No encontre ese pago recurrente.", meta, 404);
    }

    if (["cancelled", "archived"].includes(existing.status)) {
      return errorJson(
        "CONFLICT",
        "Ese pago recurrente ya no esta activo.",
        meta,
        409
      );
    }

    const body = await readJsonBody(request);
    const parsed = UpdateRecurringRuleRequestSchema.parse(body);

    if (parsed.default_account_id) {
      const account = await getAccountById(
        auth.client,
        auth.userId,
        parsed.default_account_id
      );

      if (!account) {
        return errorJson("NOT_FOUND", "No encontre esa cuenta.", meta, 404);
      }

      const targetCurrency = existing.currency;
      if (account.currency !== targetCurrency) {
        return errorJson(
          "CORE_REJECTED",
          "La cuenta sugerida y el pago deben usar la misma moneda.",
          meta,
          422
        );
      }
    }

    const serviceClient = createServiceClient();
    const recurring_rule = await updateRecurringRule(
      serviceClient,
      auth.userId,
      params.id,
      {
        name: parsed.name,
        expectedAmount: parsed.expected_amount,
        amountVariability: parsed.amount_variability,
        frequency: parsed.frequency,
        nextExpectedDate: parsed.next_expected_date,
        categoryId: parsed.category_id,
        defaultAccountId: parsed.default_account_id,
        status: parsed.status,
        metadata: {
          ...existing.metadata,
          updated_from: "dashboard_upcoming",
          trace_id,
        },
      }
    );

    return okJson({ recurring_rule }, meta);
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
