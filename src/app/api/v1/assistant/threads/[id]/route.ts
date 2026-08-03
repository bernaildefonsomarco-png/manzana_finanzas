import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  buildCursorOrFilter,
  clampLimit,
  decodeCursor,
  paginate,
} from "@/app/api/_lib/pagination";
import {
  AssistantRepositoryError,
  archiveAssistantThread,
  getAssistantThreadById,
  listAssistantMessages,
} from "@/data/repositories/assistant.repository";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

const ListMessagesQuerySchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.coerce.number().int().positive().optional(),
});

const PatchBodySchema = z
  .object({
    status: z.literal("archivado"),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

/** `SCR-ASI-03`: mensajes de un hilo, paginados por cursor (`41` S16, "hilo largo"). */
export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const thread = await getAssistantThreadById(auth.client, auth.userId, params.id);
    if (!thread) {
      return errorJson("NOT_FOUND", "Esa conversacion ya no esta.", meta, 404);
    }

    const url = new URL(request.url);
    const query = ListMessagesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const messages = await listAssistantMessages(auth.client, auth.userId, params.id, {
      limit: limit + 1,
      cursorFilter: cursor
        ? buildCursorOrFilter("created_at", cursor, "asc")
        : undefined,
    });

    const { data: pageRows, page } = paginate(messages, limit, (row) => row.created_at);

    return okJson({ thread, messages: pageRows }, { ...meta, page });
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

/** `ACT-ASI-10`: archivar una conversacion. */
export async function PATCH(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    await PatchBodySchema.parseAsync(await request.json().catch(() => ({})));

    const thread = await archiveAssistantThread(auth.client, auth.userId, params.id);

    return okJson({ thread }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (
    error instanceof AssistantRepositoryError &&
    error.code === "THREAD_NOT_FOUND"
  ) {
    return errorJson("NOT_FOUND", "Esa conversacion ya no esta.", meta, 404);
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
