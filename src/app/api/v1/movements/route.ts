import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@/core/finance";
import { evaluateCrossChannelDedup } from "@/core/dedup";
import { CoreError } from "@/core/finance/errors";
import { DebtCreationCommandHandler } from "@/core/debts/debt-creation-command";
import { DebtPaymentCommandHandler } from "@/core/debts/debt-payment-command";
import { SupabaseDebtCreationExecutionPort } from "@/data/repositories/debt-creation-command.repository";
import { SupabaseDebtPaymentExecutionPort } from "@/data/repositories/debt-payment-command.repository";
import { getDebtById } from "@/data/repositories/debts.repository";
import { createServiceClient } from "@/data/supabase/server";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import { sortMovementsByRegistrationRecency } from "@/features/movements/movement-sort";
import { toIsoDate, utcIsoToLimaParts } from "@/shared/dates/lima";
import type { Movement } from "@/shared/types/domain";
import { getApiAuth } from "@/app/api/_lib/auth";
import { ClassificationCommandDispatcher } from "@/core/classification";
import { validateMovementClassificationReferences } from "@/data/repositories/classification.repository";
import { classificationCommand } from "@/app/api/v1/classification/route-helpers";
import {
  coreError,
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import {
  buildCompositeCursorOrFilter,
  clampLimit,
  decodeCompositeCursor,
  paginateComposite,
} from "@/app/api/_lib/pagination";
import {
  CreateDebtOriginationMovementRequestSchema,
  CreateDebtPaymentMovementRequestSchema,
  CreateMovementRequestSchema,
  detectMovementCreationKind,
  ListMovementsQuerySchema,
  toMovementInput,
} from "./schemas";

const MOVEMENTS_ORDER_COLUMNS = ["created_at", "occurred_at"];

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
    const query = ListMovementsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );

    const cursor = decodeCompositeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }

    const limit = clampLimit(query.limit);

    let builder = auth.client
      .from("movements")
      .select(
        "id, user_id, type, status, amount, currency, occurred_at, description, merchant, category_id, subcategory_id, source, source_ref, idempotency_key, confidence, requires_review, account_origin_id, account_destination_id, box_origin_id, box_destination_id, debt_id, recurring_rule_id, recurring_occurrence_id, related_person_id, affects_total_balance, affects_account_balance, created_at, updated_at, deleted_at, metadata"
      )
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .order("occurred_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (!query.include_deleted) {
      builder = builder.is("deleted_at", null);
    }

    if (query.type) builder = builder.eq("type", query.type);
    if (query.status) builder = builder.eq("status", query.status);
    if (query.category_id) builder = builder.eq("category_id", query.category_id);
    if (query.from) builder = builder.gte("occurred_at", query.from);
    if (query.to) builder = builder.lte("occurred_at", query.to);
    if (query.account_id) {
      builder = builder.or(
        `account_origin_id.eq.${query.account_id},account_destination_id.eq.${query.account_id}`
      );
    }
    // `AC-MOV-05`: busqueda de texto libre sobre comercio y descripcion.
    if (query.q) {
      builder = builder.textSearch("search_vector", query.q, {
        type: "websearch",
        config: "spanish",
      });
    }
    if (cursor) {
      builder = builder.or(
        buildCompositeCursorOrFilter(MOVEMENTS_ORDER_COLUMNS, cursor, "desc")
      );
    }

    const { data, error } = await builder;

    if (error) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude leer los movimientos.",
        meta,
        500
      );
    }

    const { data: pageRows, page } = paginateComposite(
      (data ?? []) as Movement[],
      limit,
      (row) => [row.created_at, row.occurred_at]
    );

    return okJson(
      { movements: sortMovementsByRegistrationRecency(pageRows) },
      { ...meta, page }
    );
  } catch (error) {
    if (error instanceof Response) return error;
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

    const normalizedIdempotencyKey = readIdempotencyKey(request);
    if (!normalizedIdempotencyKey) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para guardar el movimiento.",
        meta,
        400
      );
    }

    const body = await readJsonBody(request);
    const kind = detectMovementCreationKind(body);

    if (kind === "debt_origination") {
      return await postDebtOriginationMovement({
        body,
        auth,
        idempotencyKey: normalizedIdempotencyKey,
        trace_id,
        meta,
      });
    }

    if (kind === "debt_payment") {
      return await postDebtPaymentMovement({
        body,
        auth,
        idempotencyKey: normalizedIdempotencyKey,
        trace_id,
        meta,
      });
    }

    return await postGenericMovement({
      body,
      auth,
      idempotencyKey: normalizedIdempotencyKey,
      trace_id,
      meta,
    });
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

type PostContext = {
  body: unknown;
  auth: NonNullable<Awaited<ReturnType<typeof getApiAuth>>>;
  idempotencyKey: string;
  trace_id: string;
  meta: { trace_id: string };
};

// `RUL-MOV-10`/`ERR-MOV-08`: un gasto que no ocurrio no es un movimiento, es
// un pago que viene (`30_modulo_recurrentes_y_pagos_que_vienen.md`).
function rejectFutureOccurredAt(occurredAt: string, meta: { trace_id: string }) {
  if (new Date(occurredAt).getTime() > Date.now()) {
    return errorJson(
      "VALIDATION_ERROR",
      "Esa fecha todavía no llega. ¿Quieres anotarlo como un pago que viene?",
      meta,
      400,
      { reason: "future_date" },
    );
  }
  return null;
}

// WEB-D195: gasto, ingreso, transferencia, asignacion_interna, ajuste y
// pago_recurrente (sin ocurrencia) comparten este camino generico.
async function postGenericMovement({
  body,
  auth,
  idempotencyKey,
  trace_id,
  meta,
}: PostContext) {
  const parsed = CreateMovementRequestSchema.parse(body);
  const futureDateError = rejectFutureOccurredAt(parsed.occurred_at, meta);
  if (futureDateError) return futureDateError;
  const serviceClient = createServiceClient();
  await validateMovementClassificationReferences(serviceClient, {
    userId: auth.userId,
    subcategoryId: parsed.subcategory_id ?? null,
    relatedPersonId: parsed.related_person_id ?? null,
    tagIds: parsed.tag_ids ?? [],
  });
  const repository = new SupabaseFinancialCoreRepository(serviceClient);
  const dispatcher = new CommandDispatcher(repository);
  let movementInput = toMovementInput(parsed);
  const existing = await repository.findMovementByIdempotencyKey(
    auth.userId,
    idempotencyKey,
  );

  if (!existing) {
    const dedup = await evaluateCrossChannelDedup({
      client: serviceClient,
      userId: auth.userId,
      traceId: trace_id,
      referenceId: `dashboard:${idempotencyKey}`,
      movementInput,
      metadata: { entry_surface: "dashboard_manual" },
    });
    const decision = dedup.decision;

    if (
      decision &&
      decision.status !== "distinct" &&
      !parsed.confirm_duplicate
    ) {
      return errorJson(
        "CONFLICT",
        decision.status === "exact_duplicate"
          ? "Este movimiento ya fue registrado."
          : "Encontré un movimiento parecido. Revísalo antes de guardar otro.",
        meta,
        409,
        {
          reason: "cross_channel_duplicate",
          requires_confirmation: decision.requires_confirmation,
          dedup_status: decision.status,
          matched_movement_id: decision.matched_reference_id,
          score: decision.score,
        },
      );
    }

    if (decision && decision.status !== "distinct") {
      movementInput = {
        ...movementInput,
        metadata: {
          ...movementInput.metadata,
          dedup_override_confirmed: true,
          dedup_status: decision.status,
          dedup_matched_reference_id: decision.matched_reference_id,
          dedup_score: decision.score,
        },
      };
    }
  }

  const result = await dispatcher.dispatch({
    type: "CreateMovementCommand",
    command_id: randomUUID(),
    user_id: auth.userId,
    actor: { type: "user", id: auth.userId },
    source: "api.v1.movements.post",
    trace_id,
    payload: {
      movement: movementInput,
      idempotency_key: idempotencyKey,
    },
  });

  if (parsed.tag_ids !== undefined) {
    await new ClassificationCommandDispatcher(serviceClient).dispatch(
      classificationCommand({
        type: "SetMovementTagsCommand",
        userId: auth.userId,
        traceId: trace_id,
        source: "api.v1.movements.post.tags",
        payload: {
          movement_id: result.movement.id,
          tag_ids: parsed.tag_ids,
          assignment_source: "user",
          confirmed_by_user: true,
        },
      }),
    );
  }

  const status =
    result.type === "movement_created" && result.idempotent ? 200 : 201;

  return okJson(result, meta, { status });
}

// WEB-D195, WEB-D198: deuda_adquirida, prestamo_dado, prestamo_recibido
// crean la deuda (y su movimiento vinculado si hay cuenta) via
// CreateDebtCommand, nunca escribiendo `movements` crudo.
async function postDebtOriginationMovement({
  body,
  auth,
  idempotencyKey,
  trace_id,
  meta,
}: PostContext) {
  const parsed = CreateDebtOriginationMovementRequestSchema.parse(body);
  const futureDateError = rejectFutureOccurredAt(parsed.occurred_at, meta);
  if (futureDateError) return futureDateError;
  const serviceClient = createServiceClient();
  const limaParts = utcIsoToLimaParts(parsed.occurred_at);
  const openedAt = toIsoDate(limaParts.year, limaParts.month, limaParts.day);

  const debtCreationHandler = new DebtCreationCommandHandler(
    new SupabaseDebtCreationExecutionPort(serviceClient),
  );
  const repository = new SupabaseFinancialCoreRepository(serviceClient);
  const dispatcher = new CommandDispatcher(repository, {
    debtCreationHandler,
  });

  const result = await dispatcher.dispatch({
    type: "CreateDebtCommand",
    command_id: randomUUID(),
    user_id: auth.userId,
    actor: { type: "user", id: auth.userId },
    source: "api.v1.movements.post.debt_origination",
    trace_id,
    payload: {
      direction: parsed.type === "prestamo_dado" ? "they_owe_me" : "i_owe",
      // WEB-D198: sin regla de producto sobre el motivo de una deuda
      // adquirida desde Movimientos, se usa "other" (no personal, no
      // encaja en un banco/tarjeta) en vez de inventar una eleccion fina.
      kind: parsed.type === "deuda_adquirida" ? "other" : "personal",
      name: parsed.description?.trim() || parsed.related_person_name,
      related_person_name: parsed.related_person_name,
      principal_amount: parsed.amount,
      currency: parsed.currency ?? "PEN",
      opened_at: openedAt,
      first_due_date: parsed.first_due_date ?? null,
      installment_count: parsed.installment_count ?? null,
      installment_amount: parsed.installment_amount ?? null,
      interest_notes: parsed.interest_notes ?? null,
      account_id: parsed.account_id ?? null,
      movement_type: parsed.type,
      idempotency_key: idempotencyKey,
      creation_source: "dashboard_manual",
    },
  });

  if (result.type !== "debt_created") {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "El Core no devolvio la deuda creada.",
    );
  }

  return okJson(
    {
      debt: result.debt,
      installments: result.installments,
      movement: result.loan_movement,
      idempotent: result.idempotent,
    },
    meta,
    { status: result.idempotent ? 200 : 201 },
  );
}

// WEB-D195: pago_deuda y devolucion_recibida exigen una deuda existente y se
// despachan via RecordDebtPaymentCommand, que deriva el tipo real del
// `direction` de la deuda -y aqui se valida contra lo que el usuario eligio.
async function postDebtPaymentMovement({
  body,
  auth,
  idempotencyKey,
  trace_id,
  meta,
}: PostContext) {
  const parsed = CreateDebtPaymentMovementRequestSchema.parse(body);
  const futureDateError = rejectFutureOccurredAt(parsed.occurred_at, meta);
  if (futureDateError) return futureDateError;
  const debt = await getDebtById(auth.client, auth.userId, parsed.debt_id);
  if (!debt) {
    return errorJson("NOT_FOUND", "No encontré esa deuda.", meta, 404);
  }

  const expectedType =
    debt.direction === "i_owe" ? "pago_deuda" : "devolucion_recibida";
  if (expectedType !== parsed.type) {
    return errorJson(
      "VALIDATION_ERROR",
      debt.direction === "i_owe"
        ? "Esa deuda es tuya: registra un pago de deuda, no una devolucion."
        : "Esa deuda te la deben: registra una devolucion recibida, no un pago.",
      meta,
      400,
    );
  }

  const accountId =
    parsed.type === "pago_deuda"
      ? parsed.account_origin_id
      : parsed.account_destination_id;

  const serviceClient = createServiceClient();
  const debtPaymentHandler = new DebtPaymentCommandHandler(
    new SupabaseDebtPaymentExecutionPort(auth.client, serviceClient),
  );
  const repository = new SupabaseFinancialCoreRepository(serviceClient);
  const dispatcher = new CommandDispatcher(repository, {
    debtPaymentHandler,
  });

  const result = await dispatcher.dispatch({
    type: "RecordDebtPaymentCommand",
    command_id: randomUUID(),
    user_id: auth.userId,
    actor: { type: "user", id: auth.userId },
    source: "api.v1.movements.post.debt_payment",
    trace_id,
    payload: {
      debt_id: parsed.debt_id,
      amount: parsed.amount,
      currency: parsed.currency ?? null,
      account_id: accountId ?? null,
      installment_id: null,
      installment_number: null,
      paid_at: parsed.occurred_at,
      note: parsed.description ?? null,
      idempotency_key: idempotencyKey,
      payment_source: "dashboard_manual",
    },
  });

  if (result.type !== "debt_payment_recorded") {
    throw new CoreError(
      "CORE_REPOSITORY_ERROR",
      "El Core no devolvio el pago de deuda registrado.",
    );
  }

  return okJson(
    {
      movement: result.movement,
      debt: result.debt,
      payment: result.payment,
      installment_allocations: result.installment_allocations,
      idempotent: result.idempotent,
    },
    meta,
    { status: result.idempotent ? 200 : 201 },
  );
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof CoreError) return coreError(error, meta);
  if (error instanceof SyntaxError) {
    return errorJson("VALIDATION_ERROR", "JSON invalido.", meta, 400);
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
