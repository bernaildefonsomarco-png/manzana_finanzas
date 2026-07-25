import { PENDING_STATUSES } from "@/shared/types/domain";
import {
  listPendingItems,
  PendingRepositoryError,
} from "@/data/repositories/pending.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { ListPendingQuerySchema } from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const url = new URL(request.url);
    const query = ListPendingQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const statuses = query.status
      ? [query.status]
      : query.include_resolved
        ? [...PENDING_STATUSES]
        : undefined;

    const pendingItems = await listPendingItems(auth.client, auth.userId, {
      statuses,
      source: query.source,
      type: query.type,
      limit: query.limit,
    });

    return okJson({ pending_items: pendingItems }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof PendingRepositoryError) {
    return errorJson(
      "INTERNAL_ERROR",
      "No pude leer los pendientes.",
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
