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
import { handleWebAssistantTurn } from "@/core/assistant/handle-web-turn";
import {
  createAssistantThread,
  getAssistantThreadById,
  listAssistantMessages,
} from "@/data/repositories/assistant.repository";

export const dynamic = "force-dynamic";
// El ejecutivo conversacional puede timeoutear a los 30s (su propio
// presupuesto interno); cuando eso pasa, el turno necesita tiempo
// ADICIONAL despues de ese timeout para caer al planificador legado
// (turn-coordinator.ts) sin que la plataforma mate la funcion a mitad de
// esa caida. 60s le da margen real a esa segunda pasada.
export const maxDuration = 60;

// `41` S11: cliente autenticado, sin excepcion de service-role. El
// compilador de la capa semantica y el resto del motor inyectan la
// identidad de este mismo cliente (WEB-D021); ver WEB-D264 sobre por que
// esto se sostiene (executeReadyDataActions apagado por defecto).
const TurnBodySchema = z
  .object({
    thread_id: z.string().uuid().nullable().optional(),
    text: z.string().trim().min(1).max(4000),
  })
  .strict();

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para enviar el turno.",
        meta,
        400
      );
    }

    const body = TurnBodySchema.parse(await readJsonBody(request));

    let threadId = body.thread_id ?? null;
    if (threadId) {
      const existingThread = await getAssistantThreadById(
        auth.client,
        auth.userId,
        threadId
      );
      if (!existingThread) {
        return errorJson("NOT_FOUND", "Esa conversacion ya no esta.", meta, 404);
      }
    } else {
      const thread = await createAssistantThread(auth.client, auth.userId);
      threadId = thread.id;
    }

    const result = await handleWebAssistantTurn({
      client: auth.client,
      userId: auth.userId,
      threadId,
      text: body.text,
      idempotencyKey,
      traceId: trace_id,
    });

    if (result.status === "rejected") {
      return errorJson("VALIDATION_ERROR", "El mensaje esta vacio.", meta, 400);
    }

    const messages = await listAssistantMessages(auth.client, auth.userId, threadId, {
      limit: 10,
    });

    return okJson(
      {
        thread_id: threadId,
        external_event_id: result.externalEventId,
        messages,
      },
      { ...meta, idempotent_replay: result.duplicate || undefined },
      { status: result.duplicate ? 200 : 201 }
    );
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
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
