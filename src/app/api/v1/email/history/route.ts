import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { listEmailCaptureHistoryForUser } from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const url = new URL(request.url);
    const query = QuerySchema.parse(Object.fromEntries(url.searchParams));
    const items = await listEmailCaptureHistoryForUser(
      createServiceClient(),
      auth.userId,
      query.limit,
    );
    return okJson(
      {
        items,
        content_persisted: false,
        sender_exposed: false,
      },
      meta,
    );
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
