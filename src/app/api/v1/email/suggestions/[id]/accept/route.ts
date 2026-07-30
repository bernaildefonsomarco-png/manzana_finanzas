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
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  getSenderSuggestionById,
  resolveSenderSuggestion,
  upsertUserEmailSource,
} from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });
const BodySchema = z
  .object({
    institution_key: z.string().trim().min(2).max(80).regex(/^[a-z0-9][a-z0-9_-]+$/),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

/** ACT-EMAIL-07: acepta la sugerencia y crea la fuente (nace en shadow). */
export async function POST(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    const body = BodySchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });

    const serviceClient = createServiceClient();
    const suggestion = await getSenderSuggestionById(serviceClient, auth.userId, params.id);
    if (!suggestion) {
      return errorJson("NOT_FOUND", "No encontre esa sugerencia.", meta, 404);
    }

    const source = await upsertUserEmailSource(serviceClient, {
      userId: auth.userId,
      institutionKey: body.institution_key,
      connectionId: suggestion.email_connection_id,
      notificationSender: suggestion.sender,
      traceId: meta.trace_id,
    });
    const resolved = await resolveSenderSuggestion(serviceClient, {
      userId: auth.userId,
      suggestionId: params.id,
      status: "accepted",
    });
    if (!resolved) {
      return errorJson("CONFLICT", "Esa sugerencia ya se resolvio.", meta, 409);
    }

    return okJson({ suggestion: resolved, source }, meta);
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
