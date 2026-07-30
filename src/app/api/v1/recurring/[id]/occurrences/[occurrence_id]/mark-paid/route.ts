import { randomUUID } from "node:crypto";
import { z } from "zod";
import { buildCreateMovementCommitPayload } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import type { CreateMovementCommand } from "@/core/finance/commands";
import type { OutboxEventDraft } from "@/core/events/domain-events";
import type { MovementDraft } from "@/core/finance/repository";
import { getAccountById } from "@/data/repositories/accounts.repository";
import {
  commitRecurringPayment,
  getRecurringOccurrenceById,
  getRecurringRuleById,
} from "@/data/repositories/recurring.repository";
import { createServiceClient } from "@/data/supabase/server";
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
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import type { RecurringOccurrence, RecurringRule } from "@/shared/types/domain";
import type { MovementInput } from "@/shared/schemas/money";
import { MarkRecurringPaidRequestSchema } from "./schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
  occurrence_id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string; occurrence_id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
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
        "Idempotency-Key invalida para registrar el pago.",
        meta,
        400
      );
    }

    const params = ParamsSchema.parse(await context.params);
    const body = await readJsonBody(request);
    const parsed = MarkRecurringPaidRequestSchema.parse(body);
    if (
      parsed.paid_at &&
      Date.parse(parsed.paid_at) > Date.now()
    ) {
      return errorJson(
        "VALIDATION_ERROR",
        "La fecha de pago no puede estar en el futuro.",
        meta,
        400,
        { field: "paid_at", rule: "ERR-REC-07" }
      );
    }
    const recurringRule = await getRecurringRuleById(
      auth.client,
      auth.userId,
      params.id
    );

    if (!recurringRule) {
      return errorJson("NOT_FOUND", "No encontre ese pago recurrente.", meta, 404);
    }

    const occurrence = await getRecurringOccurrenceById(
      auth.client,
      auth.userId,
      params.occurrence_id
    );

    if (!occurrence || occurrence.recurring_rule_id !== recurringRule.id) {
      return errorJson("NOT_FOUND", "No encontre esa ocurrencia.", meta, 404);
    }

    const isSequentialRetry = occurrence.status === "paid";
    if (!isSequentialRetry && recurringRule.status !== "active") {
      return errorJson(
        "CONFLICT",
        "Ese pago recurrente no esta activo.",
        meta,
        409,
        { recurring_rule_id: recurringRule.id, status: recurringRule.status }
      );
    }

    if (!isSequentialRetry && recurringRule.linked_debt_id) {
      return errorJson(
        "CORE_REJECTED",
        "Este pago esta vinculado a una deuda. Registralo desde Deudas para actualizar el saldo de la deuda.",
        meta,
        422,
        { linked_debt_id: recurringRule.linked_debt_id }
      );
    }

    if (!isSequentialRetry && ["skipped", "rejected"].includes(occurrence.status)) {
      return errorJson(
        "CONFLICT",
        "Esa ocurrencia ya no puede marcarse como pagada.",
        meta,
        409
      );
    }

    const account = !isSequentialRetry && parsed.account_id
      ? await getAccountById(auth.client, auth.userId, parsed.account_id)
      : null;

    if (!isSequentialRetry && parsed.account_id && !account) {
      return errorJson("NOT_FOUND", "No encontre esa cuenta.", meta, 404);
    }

    if (account && account.currency !== recurringRule.currency) {
      return errorJson(
        "CORE_REJECTED",
        "La cuenta y el pago recurrente deben tener la misma moneda.",
        meta,
        422,
        {
          account_id: account.id,
          account_currency: account.currency,
          recurring_currency: recurringRule.currency,
        }
      );
    }

    const paidAt = parsed.paid_at ?? new Date().toISOString();
    const movementCommand = buildRecurringPaymentMovementCommand({
      userId: auth.userId,
      traceId: trace_id,
      idempotencyKey,
      recurringRule,
      occurrence,
      accountId: parsed.account_id ?? null,
      amount: parsed.amount,
      paidAt,
      requestedPaidAt: parsed.paid_at ?? null,
      note: parsed.note ?? null,
    });
    const movementCommit = buildCreateMovementCommitPayload(movementCommand);
    const recurringOutboxEvents = buildRecurringPaymentOutboxEvents({
      userId: auth.userId,
      traceId: trace_id,
      recurringRule,
      occurrence,
      movement: movementCommit.movement,
      amount: parsed.amount,
      paidAt,
      idempotencyKey,
    });
    const serviceClient = createServiceClient();

    const result = await commitRecurringPayment(serviceClient, {
      recurringRuleId: recurringRule.id,
      occurrenceId: occurrence.id,
      movementCommit,
      recurringOutboxEvents,
    });

    return okJson(
      {
        movement: result.movement,
        recurring_rule: result.recurring_rule,
        occurrence: result.occurrence,
        idempotent: result.idempotent,
      },
      meta,
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function buildRecurringPaymentMovementCommand(params: {
  userId: string;
  traceId: string;
  idempotencyKey: string;
  recurringRule: RecurringRule;
  occurrence: RecurringOccurrence;
  accountId: string | null;
  amount: number;
  paidAt: string;
  requestedPaidAt: string | null;
  note: string | null;
}): CreateMovementCommand {
  const description =
    params.note?.trim() || `Pago de ${params.recurringRule.name}`;

  const movement: MovementInput = {
    type: "pago_recurrente",
    amount: params.amount,
    currency: params.recurringRule.currency,
    occurred_at: params.paidAt,
    description,
    merchant: params.recurringRule.merchant_pattern,
    category_id: params.recurringRule.category_id,
    subcategory_id: params.recurringRule.subcategory_id,
    account_origin_id: params.accountId,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: params.recurringRule.id,
    recurring_occurrence_id: params.occurrence.id,
    source: "recurring_confirmed",
    source_ref: `dashboard-recurring-payment:${params.idempotencyKey}`,
    confidence: 1,
    requires_review: false,
    metadata: {
      reason: "dashboard_recurring_payment",
      recurring_rule_id: params.recurringRule.id,
      recurring_occurrence_id: params.occurrence.id,
      account_id: params.accountId,
      expected_amount: params.occurrence.expected_amount ?? params.recurringRule.expected_amount,
      trace_id: params.traceId,
      idempotency_payload: {
        recurring_rule_id: params.recurringRule.id,
        recurring_occurrence_id: params.occurrence.id,
        amount: params.amount,
        currency: params.recurringRule.currency,
        account_id: params.accountId,
        paid_at: params.requestedPaidAt,
        note: params.note,
      },
    },
  };

  return {
    type: "CreateMovementCommand",
    command_id: randomUUID(),
    user_id: params.userId,
    actor: { type: "user", id: params.userId },
    source: "api.v1.recurring.mark-paid.post",
    trace_id: params.traceId,
    payload: {
      movement,
      idempotency_key: params.idempotencyKey,
    },
  };
}

function buildRecurringPaymentOutboxEvents(params: {
  userId: string;
  traceId: string;
  recurringRule: RecurringRule;
  occurrence: RecurringOccurrence;
  movement: MovementDraft;
  amount: number;
  paidAt: string;
  idempotencyKey: string;
}): OutboxEventDraft[] {
  const expectedAmount =
    params.occurrence.expected_amount ?? params.recurringRule.expected_amount;
  const amountChanged =
    typeof expectedAmount === "number" &&
    roundMoney(expectedAmount) !== roundMoney(params.amount);
  const basePayload = {
    recurring_rule_id: params.recurringRule.id,
    recurring_occurrence_id: params.occurrence.id,
    movement_id: params.movement.id,
    amount: params.amount,
    expected_amount: expectedAmount,
    currency: params.recurringRule.currency,
    paid_at: params.paidAt,
    idempotency_key: params.idempotencyKey,
  };

  const events: OutboxEventDraft[] = [
    {
      id: randomUUID(),
      user_id: params.userId,
      event_type: "recurring_payment_confirmed",
      aggregate_type: "recurring_rule",
      aggregate_id: params.recurringRule.id,
      payload: basePayload,
      payload_version: 1,
      trace_id: params.traceId,
      metadata: {
        source: "api.v1.recurring.mark-paid.post",
        movement_type: params.movement.type,
      },
    },
  ];

  if (amountChanged) {
    events.push({
      id: randomUUID(),
      user_id: params.userId,
      event_type: "recurring_amount_changed",
      aggregate_type: "recurring_rule",
      aggregate_id: params.recurringRule.id,
      payload: basePayload,
      payload_version: 1,
      trace_id: params.traceId,
      metadata: {
        source: "api.v1.recurring.mark-paid.post",
      },
    });
  }

  return events;
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof CoreError) return coreError(error, meta);
  if (isZodLike(error)) return validationError(error, meta);

  const mapped = mapRecurringPaymentError(error, meta);
  if (mapped) return mapped;

  return unexpectedError(error, meta);
}

function mapRecurringPaymentError(error: unknown, meta: { trace_id: string }) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes("RECURRING_RULE_NOT_FOUND")) {
    return errorJson("NOT_FOUND", "No encontre ese pago recurrente.", meta, 404);
  }

  if (message.includes("RECURRING_OCCURRENCE_NOT_FOUND")) {
    return errorJson("NOT_FOUND", "No encontre esa ocurrencia.", meta, 404);
  }

  if (message.includes("RECURRING_RULE_NOT_ACTIVE")) {
    return errorJson("CONFLICT", "Ese pago recurrente no esta activo.", meta, 409);
  }

  if (message.includes("RECURRING_OCCURRENCE_ALREADY_PAID")) {
    return errorJson("CONFLICT", "Ese pago ya fue marcado como pagado.", meta, 409);
  }

  if (message.includes("RECURRING_RULE_LINKED_DEBT_REQUIRES_DEBT_FLOW")) {
    return errorJson(
      "CORE_REJECTED",
      "Este pago esta vinculado a una deuda. Registralo desde Deudas para actualizar el saldo de la deuda.",
      meta,
      422
    );
  }

  return null;
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
