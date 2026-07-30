import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import { listSenderSuggestions } from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

/** RUL-EMAIL-05: sugerencias de remitente nuevo, pendientes de decidir. */
export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const suggestions = await listSenderSuggestions(createServiceClient(), auth.userId);
    return okJson({ suggestions }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
