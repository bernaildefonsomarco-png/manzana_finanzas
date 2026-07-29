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
  buildCompositeCursorOrFilter,
  clampLimit,
  decodeCompositeCursor,
  paginateComposite,
} from "@/app/api/_lib/pagination";
import type { MovementAuditLog } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

const QuerySchema = z
  .object({
    limit: z.coerce.number().int().positive().optional(),
    cursor: z.string().optional(),
  })
  .strict();

type RouteContext = { params: Promise<{ id: string }> };

const HISTORY_ORDER_COLUMNS = ["created_at", "id"];

// `ACT-MOV-08` / `SCR-MOV-02`: historial de cambios de un movimiento.
// `26` §19 caso 12 -- se pagina, nunca se trae completo de una vez.
export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const url = new URL(request.url);
    const query = QuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );

    const cursor = decodeCompositeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const { data: movement, error: movementError } = await auth.client
      .from("movements")
      .select("id")
      .eq("id", params.id)
      .eq("user_id", auth.userId)
      .maybeSingle();

    if (movementError) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude leer el movimiento.",
        meta,
        500,
      );
    }
    if (!movement) {
      return errorJson("NOT_FOUND", "No encontré ese movimiento.", meta, 404);
    }

    let builder = auth.client
      .from("movement_audit_log")
      .select(
        "id, user_id, movement_id, entity_type, entity_id, action, field_name, old_value, new_value, source, actor_type, actor_id, trace_id, created_at, metadata",
      )
      .eq("movement_id", params.id)
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (cursor) {
      builder = builder.or(
        buildCompositeCursorOrFilter(HISTORY_ORDER_COLUMNS, cursor, "desc"),
      );
    }

    const { data, error } = await builder;
    if (error) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude leer el historial de este movimiento.",
        meta,
        500,
      );
    }

    const { data: pageRows, page } = paginateComposite(
      (data ?? []) as MovementAuditLog[],
      limit,
      (row) => [row.created_at, row.id],
    );

    return okJson({ history: pageRows }, { ...meta, page });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
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
