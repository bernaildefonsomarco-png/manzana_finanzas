import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { toJson } from "@/core/events/domain-events";
import { EXPORT_FORMATS, EXPORT_KINDS } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

// GET /exports (35 §10): historial del usuario, con estado.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { data, error } = await auth.client
      .from("export_jobs")
      .select("id,kind,format,status,row_count,requested_at,completed_at,expires_at")
      .eq("user_id", auth.userId)
      .order("requested_at", { ascending: false })
      .limit(50);
    if (error) throw error;

    return okJson({ exports: data ?? [] }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

const CreateSchema = z
  .object({
    kind: z.enum(EXPORT_KINDS),
    format: z.enum(EXPORT_FORMATS),
    metadata: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

// POST /exports (35 §10, RUL-REP-11/12): 202, Idempotency-Key obligatoria.
// Nunca genera el archivo dentro de la petición (RUL-REP-10 §10).
export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key para crear la exportación.", meta, 400);
    }

    const body = CreateSchema.parse(await request.json().catch(() => ({})));

    if (body.kind === "movimientos") {
      const { count } = await auth.client
        .from("export_jobs")
        .select("id", { count: "exact", head: true })
        .eq("user_id", auth.userId)
        .eq("kind", "movimientos")
        .gte("requested_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      if ((count ?? 0) >= 10) {
        return errorJson(
          "RATE_LIMITED",
          "Ya preparaste diez descargas de movimientos hoy. Puedes volver a pedirlo mañana.",
          meta,
          429,
        );
      }
    }

    const { data, error } = await auth.client.rpc("create_export_job", {
      p_user_id: auth.userId,
      p_kind: body.kind,
      p_format: body.format,
      p_idempotency_key: idempotencyKey,
      p_metadata: toJson(body.metadata ?? {}),
    });
    if (error) throw error;

    return okJson({ export: data }, meta, { status: 202 });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
