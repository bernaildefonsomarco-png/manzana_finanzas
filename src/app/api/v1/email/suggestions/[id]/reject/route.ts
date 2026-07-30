import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { resolveSenderSuggestion } from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

type RouteContext = { params: Promise<{ id: string }> };

/** ACT-EMAIL-08: rechaza la sugerencia. Puede volver a proponerse mas tarde. */
export async function POST(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    const resolved = await resolveSenderSuggestion(createServiceClient(), {
      userId: auth.userId,
      suggestionId: params.id,
      status: "rejected",
    });
    if (!resolved) {
      return errorJson("NOT_FOUND", "No encontre esa sugerencia.", meta, 404);
    }
    return okJson({ suggestion: resolved }, meta);
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
