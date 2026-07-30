import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  getRecurringRuleById,
  updateRecurringRule,
} from "@/data/repositories/recurring.repository";
import { createServiceClient } from "@/data/supabase/server";

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
    const existing = await getRecurringRuleById(
      auth.client,
      auth.userId,
      params.id
    );
    if (!existing) {
      return errorJson("NOT_FOUND", "No encontre ese pago recurrente.", meta, 404);
    }
    if (["cancelled", "archived"].includes(existing.status)) {
      return errorJson(
        "CONFLICT",
        "Ese pago recurrente ya estaba cerrado.",
        meta,
        409
      );
    }
    if (existing.status === "paused") {
      return okJson({ recurring_rule: existing, idempotent: true }, meta);
    }

    const recurring_rule = await updateRecurringRule(
      createServiceClient(),
      auth.userId,
      params.id,
      {
        status: "paused",
        metadata: {
          ...existing.metadata,
          paused_from: "dashboard_upcoming",
          trace_id,
        },
      }
    );
    return okJson({ recurring_rule, idempotent: false }, meta);
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
