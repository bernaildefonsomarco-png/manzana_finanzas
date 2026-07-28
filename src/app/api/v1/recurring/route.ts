import { createServiceClient } from "@/data/supabase/server";
import {
  createRecurringRule,
  listRecurringDashboard,
  sortRecurringRulesByNextExpectedDate,
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
import {
  buildCursorOrFilter,
  clampLimit,
  decodeCursor,
  paginate,
} from "@/app/api/_lib/pagination";
import {
  CreateRecurringRuleRequestSchema,
  ListRecurringQuerySchema,
} from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const url = new URL(request.url);
    const query = ListRecurringQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const data = await listRecurringDashboard(auth.client, auth.userId, query.status, {
      limit: limit + 1,
      cursorFilter: cursor
        ? buildCursorOrFilter("created_at", cursor, "desc")
        : undefined,
    });

    const { data: pageRules, page } = paginate(
      data.rules,
      limit,
      (rule) => rule.created_at
    );

    return okJson(
      {
        ...data,
        rules: sortRecurringRulesByNextExpectedDate(pageRules),
      },
      { ...meta, page }
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const body = await readJsonBody(request);
    const parsed = CreateRecurringRuleRequestSchema.parse(body);

    if (parsed.default_account_id) {
      const account = await getAccountById(
        auth.client,
        auth.userId,
        parsed.default_account_id
      );

      if (!account) {
        return errorJson("NOT_FOUND", "No encontre esa cuenta.", meta, 404);
      }

      if (account.currency !== parsed.currency) {
        return errorJson(
          "CORE_REJECTED",
          "La cuenta sugerida y el pago deben usar la misma moneda.",
          meta,
          422
        );
      }
    }

    const serviceClient = createServiceClient();
    const recurring_rule = await createRecurringRule(serviceClient, {
      userId: auth.userId,
      name: parsed.name,
      expectedAmount: parsed.expected_amount,
      amountVariability: parsed.amount_variability,
      currency: parsed.currency,
      frequency: parsed.frequency,
      nextExpectedDate: parsed.next_expected_date,
      categoryId: parsed.category_id ?? null,
      defaultAccountId: parsed.default_account_id ?? null,
      source: "dashboard_manual",
      metadata: {
        created_from: "dashboard_upcoming",
        trace_id,
        note: "Expected recurring payments do not affect balances until marked paid through Core.",
      },
    });

    return okJson({ recurring_rule }, meta, { status: 201 });
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
