import { randomUUID } from "node:crypto";
import { createServiceClient } from "@/data/supabase/server";
import { refreshDebtLifecycle } from "@/core/debts/debt-lifecycle-service";
import { DebtCreationCommandHandler } from "@/core/debts/debt-creation-command";
import { recordInitialOnboardingValue } from "@/core/onboarding/onboarding-activation";
import {
  listDebts,
  sortDebtsByNextPaymentDate,
} from "@/data/repositories/debts.repository";
import { SupabaseDebtCreationExecutionPort } from "@/data/repositories/debt-creation-command.repository";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  coreError,
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
      direction: query.direction,
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

    const handler = new DebtCreationCommandHandler(
      new SupabaseDebtCreationExecutionPort(serviceClient)
    );
    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(serviceClient),
      { debtCreationHandler: handler }
    );
    const result = await dispatcher.dispatch({
      type: "CreateDebtCommand",
      command_id: randomUUID(),
      user_id: auth.userId,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.debts.post",
      trace_id,
      payload: {
        direction: parsed.direction,
        kind: parsed.kind,
        name: parsed.name,
        related_person_name: parsed.related_person_name ?? null,
        principal_amount: parsed.principal_amount,
        currency: parsed.currency,
        opened_at: parsed.opened_at ?? limaIsoDate(),
        due_date: parsed.due_date ?? null,
        first_due_date: parsed.next_payment_date ?? parsed.due_date ?? null,
        installment_count: parsed.installment_count ?? null,
        installment_amount: parsed.installment_amount ?? null,
        interest_notes: parsed.interest_notes ?? null,
        account_id: parsed.account_id ?? null,
        movement_type:
          parsed.direction === "they_owe_me"
            ? "prestamo_dado"
            : parsed.account_id
              ? "prestamo_recibido"
              : "deuda_adquirida",
        idempotency_key: idempotencyKey,
        creation_source: "dashboard_manual",
      },
    });
    const { debt, idempotent } = result;

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
    if (error instanceof CoreError) return coreError(error, meta);
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

function limaIsoDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
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
