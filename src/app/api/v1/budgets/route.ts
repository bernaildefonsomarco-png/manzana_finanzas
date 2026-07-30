import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import {
  buildCursorOrFilter,
  decodeCursor,
  paginate,
} from "@/app/api/_lib/pagination";
import {
  commitBudgetOperation,
  listBudgetsWithProgress,
} from "@/data/repositories/budgets.repository";
import { isoDateInLima } from "@/shared/dates/lima";
import { budgetRouteError } from "./operation-http";
import {
  CreateBudgetRequestSchema,
  ListBudgetsQuerySchema,
} from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const query = ListBudgetsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const rows = await listBudgetsWithProgress(auth.client, auth.userId, {
      date: query.date ?? isoDateInLima(),
      periodKind: query.period_kind,
      statuses: query.status,
      kind: query.kind,
      categoryId: query.category_id,
      limit: query.limit + 1,
      cursorFilter: cursor
        ? buildCursorOrFilter("created_at", cursor, "desc")
        : undefined,
    });
    const { data: budgets, page } = paginate(
      rows,
      query.limit,
      (row) => row.created_at
    );
    return okJson({ budgets, timezone: "America/Lima" }, { ...meta, page });
  } catch (error) {
    return budgetRouteError(error, meta);
  }
}

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para crear el presupuesto.",
        meta,
        400
      );
    }
    const input = CreateBudgetRequestSchema.parse(await readJsonBody(request));
    const result = await commitBudgetOperation(auth.client, auth.userId, {
      operation: "create",
      budgetId: null,
      idempotencyKey,
      traceId: meta.trace_id,
      payload: {
        ...input,
        category_id: input.category_id ?? null,
        date: input.date ?? isoDateInLima(),
        currency: "PEN",
      },
    });
    return okJson(
      { budget: result.budget },
      { ...meta, idempotent_replay: result.idempotent || undefined },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    return budgetRouteError(error, meta);
  }
}
