import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import { createServiceClient } from "@/data/supabase/server";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import {
  reverseDebtPayment,
  reverseRecurringPayment,
} from "@/data/repositories/specialized-payment-reversal.repository";
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
  DeleteMovementRequestSchema,
  toMovementPatch,
  UpdateMovementRequestSchema,
} from "../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const { data, error } = await auth.client
      .from("movements")
      .select(
        "id, user_id, type, status, amount, currency, occurred_at, description, merchant, category_id, subcategory_id, source, source_ref, idempotency_key, confidence, requires_review, account_origin_id, account_destination_id, box_origin_id, box_destination_id, debt_id, recurring_rule_id, recurring_occurrence_id, related_person_id, affects_total_balance, affects_account_balance, created_at, updated_at, deleted_at, metadata"
      )
      .eq("user_id", auth.userId)
      .eq("id", params.id)
      .maybeSingle();

    if (error) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude leer el movimiento.",
        meta,
        500
      );
    }

    if (!data) {
      return errorJson("NOT_FOUND", "Movimiento no encontrado.", meta, 404);
    }

    return okJson({ movement: data }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const body = await readJsonBody(request);
    const parsed = UpdateMovementRequestSchema.parse(body);
    // `RUL-MOV-10`/`ERR-MOV-08`: tambien se aplica al corregir la fecha.
    if (
      parsed.patch.occurred_at &&
      new Date(parsed.patch.occurred_at).getTime() > Date.now()
    ) {
      return errorJson(
        "VALIDATION_ERROR",
        "Esa fecha todavía no llega. ¿Quieres anotarlo como un pago que viene?",
        meta,
        400,
        { reason: "future_date" },
      );
    }
    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(createServiceClient())
    );

    const result = await dispatcher.dispatch({
      type: "UpdateMovementCommand",
      command_id: randomUUID(),
      user_id: auth.userId,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.movements.patch",
      trace_id,
      payload: {
        movement_id: params.id,
        patch: toMovementPatch(parsed.patch),
        reason: parsed.reason,
      },
    });

    return okJson(result, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const body = await readJsonBody(request);
    const parsed = DeleteMovementRequestSchema.parse(body);
    const { data: ownedMovement, error: ownershipError } = await auth.client
      .from("movements")
      .select(
        "id,type,status,debt_id,recurring_rule_id,recurring_occurrence_id"
      )
      .eq("user_id", auth.userId)
      .eq("id", params.id)
      .maybeSingle();

    if (ownershipError) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude comprobar el movimiento.",
        meta,
        500
      );
    }
    if (!ownedMovement) {
      return errorJson("NOT_FOUND", "Movimiento no encontrado.", meta, 404);
    }

    const serviceClient = createServiceClient();
    if (
      ownedMovement.type === "pago_recurrente" &&
      ownedMovement.recurring_rule_id &&
      ownedMovement.recurring_occurrence_id
    ) {
      const reversal = await reverseRecurringPayment(serviceClient, {
        userId: auth.userId,
        movementId: ownedMovement.id,
        reason: parsed.reason,
        mode: parsed.mode,
        traceId: trace_id,
      });
      return okJson(
        { type: "movement_deleted", ...reversal },
        { ...meta, idempotent_replay: reversal.idempotent || undefined }
      );
    }

    if (
      ["pago_deuda", "devolucion_recibida"].includes(ownedMovement.type) &&
      ownedMovement.debt_id
    ) {
      const reversal = await reverseDebtPayment(serviceClient, {
        userId: auth.userId,
        movementId: ownedMovement.id,
        reason: parsed.reason,
        mode: parsed.mode,
        traceId: trace_id,
      });
      return okJson(
        { type: "movement_deleted", ...reversal },
        { ...meta, idempotent_replay: reversal.idempotent || undefined }
      );
    }

    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(serviceClient)
    );

    const result = await dispatcher.dispatch({
      type: "DeleteMovementCommand",
      command_id: randomUUID(),
      user_id: auth.userId,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.movements.delete",
      trace_id,
      payload: {
        movement_id: params.id,
        mode: parsed.mode,
        reason: parsed.reason,
      },
    });

    return okJson(result, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof CoreError) return coreError(error, meta);
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
