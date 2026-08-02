import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";
const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

const SIGNED_URL_TTL_SECONDS = 15 * 60;

// POST /exports/[id]/link (35 §10, RUL-REP-13): enlace firmado de un solo
// uso, 15 minutos, generado al pulsar descargar — no al crear el trabajo.
// La propiedad se verifica con el cliente del usuario (RLS); la firma la
// emite el cliente de servicio porque el bucket es privado (15 §4).
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const { id } = ParamsSchema.parse(await context.params);

    const { data: job, error } = await auth.client
      .from("export_jobs")
      .select("id,status,storage_path")
      .eq("id", id)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (error) throw error;
    if (!job) return errorJson("NOT_FOUND", "Ese enlace de descarga ya no existe.", meta, 404);
    if (job.status === "expirado") {
      return errorJson("CONFLICT", "Ese enlace ya caducó. Preparo uno nuevo.", meta, 409);
    }
    if (job.status !== "listo" || !job.storage_path) {
      return errorJson("CONFLICT", "Esa descarga todavía no está lista.", meta, 409);
    }

    const serviceClient = createServiceClient();
    const { data: signed, error: signError } = await serviceClient.storage
      .from("exports")
      .createSignedUrl(job.storage_path, SIGNED_URL_TTL_SECONDS, { download: true });
    if (signError || !signed) throw signError ?? new Error("No pude generar el enlace.");

    return okJson({ url: signed.signedUrl, expires_in_seconds: SIGNED_URL_TTL_SECONDS }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error);
}
