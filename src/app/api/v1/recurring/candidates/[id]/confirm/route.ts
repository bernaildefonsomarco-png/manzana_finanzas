import { z } from "zod";
import { createServiceClient } from "@/data/supabase/server";
import { getAccountById } from "@/data/repositories/accounts.repository";
import {
  buildRecurringRuleDefaultsFromCandidate,
  confirmRecurringCandidate,
  getRecurringCandidateById,
  type RecurringCandidateConfirmOverrides,
} from "@/data/repositories/recurring.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { ConfirmRecurringCandidateRequestSchema } from "../../../schemas";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
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
    const body = await readJsonBody(request);
    const parsed = ConfirmRecurringCandidateRequestSchema.parse(body);
    assertSystemActionAllowed({
      actionKind: "recurring_activation",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const candidate = await getRecurringCandidateById(
      auth.client,
      auth.userId,
      params.id
    );

    if (!candidate) {
      return errorJson("NOT_FOUND", "No encontre esa sugerencia.", meta, 404);
    }

    const overrides = toConfirmOverrides(parsed);
    const defaults = tryBuildDefaults(candidate, overrides);
    if (!defaults) {
      return errorJson(
        "VALIDATION_ERROR",
        "La sugerencia necesita monto, frecuencia y fecha antes de activarse.",
        meta,
        400
      );
    }

    if (defaults.defaultAccountId) {
      const account = await getAccountById(
        auth.client,
        auth.userId,
        defaults.defaultAccountId
      );

      if (!account) {
        return errorJson("NOT_FOUND", "No encontre esa cuenta.", meta, 404);
      }

      if (account.currency !== defaults.currency) {
        return errorJson(
          "CORE_REJECTED",
          "La cuenta sugerida y el pago deben usar la misma moneda.",
          meta,
          422
        );
      }
    }

    const serviceClient = createServiceClient();
    const result = await confirmRecurringCandidate(
      serviceClient,
      auth.userId,
      params.id,
      overrides,
      trace_id
    );

    if (!result) {
      return errorJson("NOT_FOUND", "No encontre esa sugerencia.", meta, 404);
    }

    return okJson(result, meta, { status: 201 });
  } catch (error) {
    const mapped = mapCandidateError(error, meta);
    if (mapped) return mapped;
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function toConfirmOverrides(
  parsed: z.infer<typeof ConfirmRecurringCandidateRequestSchema>
): RecurringCandidateConfirmOverrides {
  return {
    name: parsed.name,
    expectedAmount: parsed.expected_amount,
    amountVariability: parsed.amount_variability,
    currency: parsed.currency,
    frequency: parsed.frequency,
    nextExpectedDate: parsed.next_expected_date,
    categoryId: parsed.category_id,
    defaultAccountId: parsed.default_account_id,
  };
}

function tryBuildDefaults(
  candidate: Parameters<typeof buildRecurringRuleDefaultsFromCandidate>[0],
  overrides: RecurringCandidateConfirmOverrides
) {
  try {
    return buildRecurringRuleDefaultsFromCandidate(candidate, overrides);
  } catch {
    return null;
  }
}

function mapCandidateError(error: unknown, meta: { trace_id: string }) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("RECURRING_CANDIDATE_NOT_OPEN")) {
    return errorJson(
      "CONFLICT",
      "Esa sugerencia ya fue resuelta.",
      meta,
      409
    );
  }

  if (message.includes("RECURRING_CANDIDATE_INCOMPLETE")) {
    return errorJson(
      "VALIDATION_ERROR",
      "La sugerencia necesita monto, frecuencia y fecha antes de activarse.",
      meta,
      400
    );
  }

  return null;
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
