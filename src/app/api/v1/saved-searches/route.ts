import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { toJson } from "@/core/events/domain-events";

export const dynamic = "force-dynamic";

// GET /saved-searches (38 §10).
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { data, error } = await auth.client
      .from("saved_searches")
      .select("id,name,query,filters,created_at")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return okJson({ saved_searches: data ?? [] }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

const CreateSchema = z
  .object({
    name: z.string().min(1).max(60),
    query: z.string().min(1).max(200),
    filters: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// POST /saved-searches (ACT-BUS-07): guarda la consulta, no sus resultados.
export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const body = CreateSchema.parse(await request.json().catch(() => ({})));

    const { data, error } = await auth.client
      .from("saved_searches")
      .insert({
        user_id: auth.userId,
        name: body.name,
        query: body.query,
        filters: toJson(body.filters ?? {}),
      })
      .select("id,name,query,filters,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorJson("CONFLICT", "Ya tienes una búsqueda con ese nombre.", meta, 409);
      }
      throw error;
    }

    return okJson({ saved_search: data }, meta, { status: 201 });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
