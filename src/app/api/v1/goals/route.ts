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
  commitGoalOperation,
  listGoals,
} from "@/data/repositories/budgets.repository";
import { isoDateInLima } from "@/shared/dates/lima";
import { budgetRouteError } from "../budgets/operation-http";
import {
  CreateGoalRequestSchema,
  ListGoalsQuerySchema,
} from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const query = ListGoalsQuerySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const rows = await listGoals(auth.client, auth.userId, {
      statuses: query.status,
      limit: query.limit + 1,
      cursorFilter: cursor
        ? buildCursorOrFilter("created_at", cursor, "desc")
        : undefined,
      asOf: isoDateInLima(),
    });
    const { data: goals, page } = paginate(
      rows,
      query.limit,
      (row) => row.created_at
    );
    return okJson({ goals }, { ...meta, page });
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
        "Falta Idempotency-Key para crear la meta.",
        meta,
        400
      );
    }
    const input = CreateGoalRequestSchema.parse(await readJsonBody(request));
    if (input.target_date && input.target_date <= isoDateInLima()) {
      return errorJson(
        "VALIDATION_ERROR",
        "La fecha objetivo tiene que ser futura.",
        meta,
        400
      );
    }
    const result = await commitGoalOperation(auth.client, auth.userId, {
      operation: "create",
      goalId: null,
      payload: {
        ...input,
        box_id: input.box_id ?? null,
        target_date: input.target_date ?? null,
        currency: "PEN",
      },
      idempotencyKey,
      traceId: meta.trace_id,
    });
    return okJson(
      { goal: result.goal },
      { ...meta, idempotent_replay: result.idempotent || undefined },
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    return budgetRouteError(error, meta);
  }
}
