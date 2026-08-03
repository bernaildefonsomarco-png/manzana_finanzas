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
import {
  buildCursorOrFilter,
  clampLimit,
  decodeCursor,
  paginate,
} from "@/app/api/_lib/pagination";
import {
  createAssistantThread,
  listAssistantThreads,
} from "@/data/repositories/assistant.repository";

export const dynamic = "force-dynamic";

const ListQuerySchema = z.object({
  cursor: z.string().nullable().optional(),
  limit: z.coerce.number().int().positive().optional(),
  status: z.enum(["activo", "archivado"]).optional(),
});

const CreateBodySchema = z
  .object({
    title: z.string().trim().min(1).max(160).nullable().optional(),
  })
  .strict();

/** `SCR-ASI-04`: historial de conversaciones, mas reciente primero. */
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const url = new URL(request.url);
    const query = ListQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );

    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const threads = await listAssistantThreads(auth.client, auth.userId, {
      limit: limit + 1,
      status: query.status,
      cursorFilter: cursor
        ? buildCursorOrFilter("updated_at", cursor, "desc")
        : undefined,
    });

    const { data: pageRows, page } = paginate(threads, limit, (row) => row.updated_at);

    return okJson({ threads: pageRows }, { ...meta, page });
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const body = CreateBodySchema.parse(await readJsonBody(request));
    const thread = await createAssistantThread(
      auth.client,
      auth.userId,
      body.title ?? null
    );

    return okJson({ thread }, meta, { status: 201 });
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
