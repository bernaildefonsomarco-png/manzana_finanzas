import { z } from "zod";
import {
  addPendingContext,
  PendingRepositoryError,
} from "@/data/repositories/pending.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { PendingContextRequestSchema } from "../../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** RUL-EMAIL-11: aportar contexto libre alimenta la memoria (36, W-13). */
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const body = PendingContextRequestSchema.parse(await readJsonBody(request));
    const serviceClient = createServiceClient();
    const pendingItem = await addPendingContext(
      serviceClient,
      auth.userId,
      params.id,
      body.context,
      trace_id
    );

    return okJson({ pending_item: pendingItem }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof PendingRepositoryError) {
    if (error.code === "PENDING_ITEM_NOT_FOUND") {
      return errorJson("NOT_FOUND", "Pendiente no encontrado.", meta, 404);
    }
    if (error.code === "PENDING_ITEM_ALREADY_RESOLVED") {
      return errorJson("CONFLICT", "Este pendiente ya fue resuelto.", meta, 409);
    }
    return errorJson(
      "INTERNAL_ERROR",
      "No pude guardar el contexto.",
      meta,
      500
    );
  }
  if (isZodLike(error)) return validationError(error, meta);
  return unexpectedError(error, meta);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
