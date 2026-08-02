import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { toJson } from "@/core/events/domain-events";

export const dynamic = "force-dynamic";

// GET /saved-reports (35 §10).
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { data, error } = await auth.client
      .from("saved_reports")
      .select("id,name,config,created_at")
      .eq("user_id", auth.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw error;

    return okJson({ saved_reports: data ?? [] }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

const ConfigSchema = z.object({
  periodo: z.object({ tipo: z.enum(["semana", "quincena", "mes", "rango"]), valor: z.string() }),
  agrupar: z.enum(["categoria", "subcategoria", "cuenta", "tipo"]),
  comparar: z.object({ tipo: z.enum(["semana", "quincena", "mes"]), valor: z.string() }).nullable().optional(),
  filtros: z
    .object({
      categorias: z.array(z.string()).default([]),
      cuentas: z.array(z.string()).default([]),
      tipos: z.array(z.string()).default([]),
    })
    .default({ categorias: [], cuentas: [], tipos: [] }),
  grafico: z.enum(["barras_categoria", "linea_evolucion", "barras_comparadas", "ingreso_vs_gasto", "barras_apiladas_cuenta"]),
});

const CreateSchema = z.object({ name: z.string().min(1).max(60), config: ConfigSchema }).strict();

// POST /saved-reports (ACT-REP-07): guarda la configuración, nunca los datos.
export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const body = CreateSchema.parse(await request.json().catch(() => ({})));

    const { data, error } = await auth.client
      .from("saved_reports")
      .insert({ user_id: auth.userId, name: body.name, config: toJson(body.config) })
      .select("id,name,config,created_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        return errorJson("CONFLICT", "Ya tienes una vista con ese nombre.", meta, 409);
      }
      throw error;
    }

    return okJson({ saved_report: data }, meta, { status: 201 });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
