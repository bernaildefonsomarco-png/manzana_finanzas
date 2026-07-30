import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, unexpectedError } from "@/app/api/_lib/http";
import { exportUserData } from "@/data/repositories/privacy.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    if ([...new URL(request.url).searchParams].length > 0) {
      return errorJson(
        "VALIDATION_ERROR",
        "No se reconocen parametros en esta descarga.",
        meta,
        400,
      );
    }

    const data = await exportUserData(createServiceClient(), auth.userId);
    const date = data.generated_at.slice(0, 10);
    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="manzana-datos-${date}.json"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-trace-id": meta.trace_id,
      },
    });
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
