import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { disconnectGmail } from "@/core/email/email-connection";
import { prepareUserAccountDeletion } from "@/data/repositories/privacy.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const DeleteSchema = z
  .object({
    confirmation: z.literal("ELIMINAR MI CUENTA"),
  })
  .strict();

export async function DELETE(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    DeleteSchema.parse(await readJsonBody(request));

    const client = createServiceClient();
    await disconnectGmail({
      client,
      userId: auth.userId,
      traceId: meta.trace_id,
    });
    await prepareUserAccountDeletion(client, {
      userId: auth.userId,
      traceId: meta.trace_id,
    });

    const { error } = await client.auth.admin.deleteUser(auth.userId);
    if (error) throw error;

    return okJson(
      {
        deleted: true,
        gmail_disconnected: true,
        nudges_stopped: true,
      },
      meta,
    );
  } catch (error) {
    if (isZodLike(error)) {
      return validationError(
        error,
        meta,
        'Escribe exactamente "ELIMINAR MI CUENTA" para confirmar.',
      );
    }
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}
