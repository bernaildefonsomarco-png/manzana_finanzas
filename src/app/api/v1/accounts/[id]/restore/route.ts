import { z } from "zod";
import {
  restoreAccount,
  restoreBoxesForAccount,
} from "@/data/repositories/accounts.repository";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** `ACT-CUENTAS-04`: reactiva una cuenta archivada y sus cajas (24 S5.1). */
export async function POST(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);

    const serviceClient = createServiceClient();
    const account = await restoreAccount(serviceClient, auth.userId, params.id);

    if (!account) {
      return errorJson(
        "NOT_FOUND",
        "No encontre esa cuenta archivada.",
        meta,
        404
      );
    }

    const boxes = await restoreBoxesForAccount(
      serviceClient,
      auth.userId,
      account.id
    );

    return okJson({ account, restored_box_count: boxes.length }, meta);
  } catch (error) {
    if (isZodLike(error)) {
      return errorJson("VALIDATION_ERROR", "Id de cuenta invalido.", meta, 400);
    }
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
