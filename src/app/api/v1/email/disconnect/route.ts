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
import { disconnectGmail } from "@/core/email/email-connection";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const BodySchema = z
  .object({ connection_id: z.string().uuid().optional() })
  .strict();

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const body = BodySchema.parse(await readJsonBody(request));
    const result = await disconnectGmail({
      client: createServiceClient(),
      userId: auth.userId,
      traceId: meta.trace_id,
      connectionId: body.connection_id,
    });
    return okJson(result, meta);
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
