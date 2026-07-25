import { z } from "zod";
import { createServiceClient } from "@/data/supabase/server";
import { discardRecurringCandidate } from "@/data/repositories/recurring.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
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
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const serviceClient = createServiceClient();
    const candidate = await discardRecurringCandidate(
      serviceClient,
      auth.userId,
      params.id,
      trace_id
    );

    if (!candidate) {
      return errorJson("NOT_FOUND", "No encontre esa sugerencia.", meta, 404);
    }

    return okJson({ candidate }, meta);
  } catch (error) {
    const mapped = mapCandidateError(error, meta);
    if (mapped) return mapped;
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function mapCandidateError(error: unknown, meta: { trace_id: string }) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("RECURRING_CANDIDATE_ALREADY_CONFIRMED")) {
    return errorJson(
      "CONFLICT",
      "Esa sugerencia ya fue activada.",
      meta,
      409
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
