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
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import { HOME_BLOCK_KINDS } from "@/core/home/home-composer";
import { getHomeHiddenBlocks, setHomeBlockHidden } from "@/data/repositories/home.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const PatchSchema = z
  .object({
    block: z.enum(HOME_BLOCK_KINDS),
    hidden: z.boolean(),
  })
  .strict();

// PATCH /home/preferences (39 §10, ACT-HOME-07): ocultar o mostrar un
// bloque. `learned_preferences` no admite escritura del cliente (RLS "no
// client write"), así que la propiedad se verifica con el cliente
// autenticado antes de escribir con `service_role` (mismo patrón que
// `v1/exports/*/link`, `52`). Idempotente: repetir el mismo `{block,hidden}`
// no cambia nada ni falla.
export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const hidden = await getHomeHiddenBlocks(auth.client, auth.userId);
    return okJson({ hidden_blocks: hidden }, meta, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function PATCH(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson("VALIDATION_ERROR", "Falta Idempotency-Key para guardar la preferencia.", meta, 400);
    }

    const input = PatchSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });

    const hidden = await setHomeBlockHidden(createServiceClient(), auth.userId, input.block, input.hidden);
    return okJson({ hidden_blocks: hidden }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "issues" in error && Array.isArray((error as { issues?: unknown }).issues));
}
