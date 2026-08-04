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
import { recordAccountEvent, requestMeta } from "@/core/auth/account-events";
import {
  getAccountDeletionImpact,
  prepareUserAccountDeletion,
} from "@/data/repositories/privacy.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const DeleteSchema = z
  .object({
    confirmation: z.literal("ELIMINAR MI CUENTA"),
  })
  .strict();

// `43` `SCR-AUTH-08` — cifras reales para "vas a perder: 1.847 movimientos…"
// antes de confirmar. Se lee bajo RLS con la sesión del propio usuario, no
// con service-role: es una lectura, no la eliminación.
export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const impact = await getAccountDeletionImpact(auth.client, auth.userId);
    return okJson({ impact }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function DELETE(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    DeleteSchema.parse(await readJsonBody(request));

    const client = createServiceClient();

    // `43` `RUL-AUTH-10`: "se escribe el evento, se anonimiza su user_id a
    // nulo, y luego se elimina el usuario". Se escribe ANTES de borrar
    // porque `account_events.user_id` exige `auth.uid()` propio para
    // insertar (RLS de la migración `066`) — tras `deleteUser` ya no hay
    // usuario con quien cumplir esa política. La anonimización la hace sola
    // la FK `on delete set null` de la migración `066` en el paso de abajo.
    const { ip, userAgent } = requestMeta(request);
    await recordAccountEvent(client, {
      userId: auth.userId,
      kind: "eliminacion_solicitada",
      ip,
      userAgent,
    });

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
