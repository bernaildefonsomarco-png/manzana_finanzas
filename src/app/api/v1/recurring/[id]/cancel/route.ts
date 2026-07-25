import { z } from "zod";
import { createServiceClient } from "@/data/supabase/server";
import {
  cancelRecurringRule,
  getRecurringRuleById,
} from "@/data/repositories/recurring.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";

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
    const existing = await getRecurringRuleById(auth.client, auth.userId, params.id);
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

    const serviceClient = createServiceClient();
    const recurring_rule = await cancelRecurringRule(
      serviceClient,
      auth.userId,
      params.id,
      trace_id
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
