import { createServiceClient } from "@/data/supabase/server";
import { refreshDebtLifecycle } from "@/core/debts/debt-lifecycle-service";
import { recordInitialOnboardingValue } from "@/core/onboarding/onboarding-activation";
import {
  createDebt,
  listDebts,
  sortDebtsByNextPaymentDate,
} from "@/data/repositories/debts.repository";
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
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import { CreateDebtRequestSchema, ListDebtsQuerySchema } from "./schemas";
import { logger } from "@/shared/telemetry/logger";

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
    const query = ListDebtsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );

    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const debts = await listDebts(auth.client, auth.userId, query.status, {
      limit: limit + 1,
      cursorFilter: cursor
        ? buildCursorOrFilter("created_at", cursor, "desc")
        : undefined,
    });

    const { data: pageRows, page } = paginate(debts, limit, (row) => row.created_at);

    return okJson(
      { debts: sortDebtsByNextPaymentDate(pageRows) },
      { ...meta, page }
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
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

    const idempotencyKey = readIdempotencyKey(request);
    if (!idempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para crear la deuda.",
        meta,
        400
      );
    }

    const body = await readJsonBody(request);
    const parsed = CreateDebtRequestSchema.parse(body);
    const serviceClient = createServiceClient();

    const { debt, idempotent } = await createDebt(serviceClient, {
      userId: auth.userId,
      direction: parsed.direction,
      kind: parsed.kind,
      name: parsed.name,
      relatedPersonName: parsed.related_person_name ?? null,
      principalAmount: parsed.principal_amount,
      currency: parsed.currency,
      openedAt: parsed.opened_at ?? undefined,
      dueDate: parsed.due_date ?? null,
      nextPaymentDate: parsed.next_payment_date ?? null,
      installmentCount: parsed.installment_count ?? null,
      installmentAmount: parsed.installment_amount ?? null,
      interestNotes: parsed.interest_notes ?? null,
      source: "dashboard_manual",
      metadata: {
        created_from: "dashboard_debts",
        trace_id,
        note: "Debt creation does not affect balances until a payment is recorded through Core.",
      },
      idempotencyKey,
    });

    if (!idempotent) {
      try {
        await refreshDebtLifecycle(serviceClient, auth.userId, {
          traceId: trace_id,
        });
      } catch (error) {
        logger.error("debts.create_lifecycle_refresh_deferred", {
          error,
          user_id: auth.userId,
          debt_id: debt.id,
          trace_id,
        });
      }

      try {
        await recordInitialOnboardingValue(serviceClient, {
          userId: auth.userId,
          trigger: "debt_created",
          source: "dashboard_debts",
          traceId: trace_id,
        });
      } catch (error) {
        logger.error("debts.create_onboarding_refresh_deferred", {
          error,
          user_id: auth.userId,
          debt_id: debt.id,
          trace_id,
        });
      }
    }

    return okJson(
      { debt },
      { ...meta, idempotent_replay: idempotent || undefined },
      { status: idempotent ? 200 : 201 }
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);

    if (isConflictError(error)) {
      return errorJson(
        "CONFLICT",
        "Ya existe una persona o entidad activa con ese nombre.",
        meta,
        409
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
      Array.isArray((error as { issues?: unknown }).issues)
  );
}

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const code = (error as { code?: unknown }).code;
  return code === "23505" || code === "23P01";
}
