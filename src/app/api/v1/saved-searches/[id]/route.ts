import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

// DELETE /saved-searches/[id] (ACT-BUS-08): confirma; deshacer restaura
// (borrado lógico vía deleted_at, nunca DELETE físico).
export async function DELETE(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);

    const { data, error } = await auth.client
      .from("saved_searches")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return errorJson("NOT_FOUND", "Esa búsqueda guardada ya no existe.", meta, 404);

    return okJson({ id, deleted: true }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
