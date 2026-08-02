import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

// GET /exports/[id] (35 §10): estado de uno.
export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);

    const { data, error } = await auth.client
      .from("export_jobs")
      .select("id,kind,format,status,row_count,requested_at,completed_at,expires_at,failure_reason")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return errorJson("NOT_FOUND", "Esa descarga ya no existe.", meta, 404);

    return okJson({ export: data }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
