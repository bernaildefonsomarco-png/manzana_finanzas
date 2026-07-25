import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { updateEmailAiExtractionConsent } from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({
    connection_id: z.string().uuid(),
    enabled: z.boolean(),
  })
  .strict();

export async function PUT(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson(
        "AUTH_REQUIRED",
        "Necesitas iniciar sesion.",
        meta,
        401,
      );
    }
    const body = BodySchema.parse(await request.json());
    const consent = await updateEmailAiExtractionConsent(
      createServiceClient(),
      {
        userId: auth.userId,
        connectionId: body.connection_id,
        enabled: body.enabled,
      },
    );
    return okJson({ consent }, meta);
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
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
