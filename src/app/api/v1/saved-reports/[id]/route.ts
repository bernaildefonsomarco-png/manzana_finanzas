import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

const PatchSchema = z.object({ name: z.string().min(1).max(60).optional() }).strict();

// PATCH /saved-reports/[id]: renombrar una vista guardada.
export async function PATCH(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);
    const body = PatchSchema.parse(await request.json().catch(() => ({})));

    const { data, error } = await auth.client
      .from("saved_reports")
      .update(body)
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id,name,config,created_at")
      .maybeSingle();
    if (error) {
      if (error.code === "23505") return errorJson("CONFLICT", "Ya tienes una vista con ese nombre.", meta, 409);
      throw error;
    }
    if (!data) return errorJson("NOT_FOUND", "Esa vista guardada ya no existe.", meta, 404);

    return okJson({ saved_report: data }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

// DELETE /saved-reports/[id] (ACT-REP-08): confirma; deshacer restaura.
export async function DELETE(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);

    const { data, error } = await auth.client
      .from("saved_reports")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return errorJson("NOT_FOUND", "Esa vista guardada ya no existe.", meta, 404);

    return okJson({ id, deleted: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
