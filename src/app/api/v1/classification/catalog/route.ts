import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import { getClassificationCatalog } from "@/data/repositories/classification.repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    return okJson(await getClassificationCatalog(auth.client, auth.userId), meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

