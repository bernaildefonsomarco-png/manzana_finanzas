import { randomUUID } from "node:crypto";
import { z } from "zod";
import { DebtPaymentCommandHandler } from "@/core/debts/debt-payment-command";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import { SupabaseDebtPaymentExecutionPort } from "@/data/repositories/debt-payment-command.repository";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import {
  getDebtById,
  listDebtPaymentsForDebt,
} from "@/data/repositories/debts.repository";
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
import { CreateDebtPaymentRequestSchema } from "./schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    const debt = await getDebtById(auth.client, auth.userId, params.id);
    if (!debt) {
      return errorJson("NOT_FOUND", "No encontre esa deuda.", meta, 404);
    }
    const payments = await listDebtPaymentsForDebt(
      auth.client,
      auth.userId,
      debt.id
    );
    return okJson({ payments }, meta);
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

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
    const body = CreateDebtPaymentRequestSchema.parse(await readJsonBody(request));
    const serviceClient = createServiceClient();
    const debtPaymentHandler = new DebtPaymentCommandHandler(
      new SupabaseDebtPaymentExecutionPort(auth.client, serviceClient)
    );
    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(auth.client),
      { debtPaymentHandler }
    );
    const result = await dispatcher.dispatch({
      type: "RecordDebtPaymentCommand",
      command_id: randomUUID(),
      user_id: auth.userId,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.debts.payments.post",
      trace_id,
      payload: {
        debt_id: params.id,
        amount: body.amount,
        currency: body.currency ?? null,
        account_id: body.account_id ?? null,
        installment_id: null,
        installment_number: null,
        paid_at: body.paid_at ?? new Date().toISOString(),
        note: body.note ?? null,
        idempotency_key: idempotencyKey,
        payment_source: "dashboard_manual",
      },
    });

    if (result.type !== "debt_payment_recorded") {
      throw new CoreError(
        "CORE_REPOSITORY_ERROR",
        "El Core no devolvio el pago de deuda registrado."
      );
    }

    return okJson(
      {
        movement: result.movement,
        debt: result.debt,
        payment: result.payment,
        installment_allocations: result.installment_allocations,
        allocation_policy: result.allocation_policy,
        idempotent: result.idempotent,
      },
      meta,
      { status: result.idempotent ? 200 : 201 }
    );
  } catch (error) {
    if (error instanceof CoreError) return coreError(error, meta);
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
