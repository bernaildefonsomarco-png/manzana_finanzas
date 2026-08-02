import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError, validationError } from "@/app/api/_lib/http";
import { listMemoryEvents } from "@/data/repositories/memory.repository";

const QuerySchema = z.object({
  cursor: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
}).strict();

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesión.", meta, 401);
    const query = QuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams.entries()));
    const events = await listMemoryEvents(auth.client, {
      userId: auth.userId, cursor: query.cursor, limit: query.limit,
    });
    const next_cursor = events.length === query.limit ? events.at(-1)?.created_at ?? null : null;
    return okJson({ events, next_cursor }, meta, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "issues" in error) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
