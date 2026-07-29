import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import {
  getAccountById,
  getBoxById,
  softDeleteBox,
  updateBoxMeta,
} from "@/data/repositories/accounts.repository";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
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
import type { Movement } from "@/shared/types/domain";
import { DeleteBoxRequestSchema, UpdateBoxRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({
  id: z.string().uuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/** 24 §10: `GET /boxes/[id]` — detalle con progreso. */
export async function GET(request: Request, context: RouteContext) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const params = ParamsSchema.parse(await context.params);
    const box = await getBoxById(auth.client, auth.userId, params.id);

    if (!box) {
      return errorJson("NOT_FOUND", "Caja no encontrada.", meta, 404);
    }

    const account = await getAccountById(auth.client, auth.userId, box.account_id);

    return okJson({ box, account }, meta);
  } catch (error) {
    if (isZodLike(error)) {
      return errorJson("VALIDATION_ERROR", "Id de caja invalido.", meta, 400);
    }
    return unexpectedError(error, meta);
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
    const parsed = UpdateBoxRequestSchema.parse(body);
    const current = await getBoxById(auth.client, auth.userId, params.id);

    if (!current) {
      return errorJson("NOT_FOUND", "Caja no encontrada.", meta, 404);
    }

    if (
      parsed.target_amount != null &&
      current.current_balance > parsed.target_amount
    ) {
      return errorJson(
        "VALIDATION_ERROR",
        "La meta no puede quedar por debajo del saldo actual de la caja.",
        meta,
        400
      );
    }

    const box = await updateBoxMeta(auth.client, auth.userId, params.id, {
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.type !== undefined ? { type: parsed.type } : {}),
      ...(parsed.target_amount !== undefined
        ? { target_amount: parsed.target_amount }
        : {}),
      ...(parsed.target_date !== undefined
        ? { target_date: parsed.target_date }
        : {}),
    });

    return okJson({ box }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);

    if (isConflictError(error)) {
      return errorJson(
        "CONFLICT",
        "Ya existe una caja activa con ese nombre en esa cuenta.",
        meta,
        409
      );
    }

    return unexpectedError(error, meta);
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
    const parsed = DeleteBoxRequestSchema.parse(body);
    const serviceClient = createServiceClient();
    const box = await getBoxById(serviceClient, auth.userId, params.id);

    if (!box) {
      return errorJson("NOT_FOUND", "Caja no encontrada.", meta, 404);
    }

    const account = await getAccountById(
      serviceClient,
      auth.userId,
      box.account_id
    );

    if (!account) {
      return errorJson(
        "CONFLICT",
        "No pude liberar esta caja porque su cuenta ya no esta disponible.",
        meta,
        409
      );
    }

    let releaseMovement: Movement | null = null;

    if (box.current_balance > 0) {
      const dispatcher = new CommandDispatcher(
        new SupabaseFinancialCoreRepository(serviceClient)
      );
      const result = await dispatcher.dispatch({
        type: "CreateMovementCommand",
        command_id: randomUUID(),
        user_id: auth.userId,
        actor: { type: "user", id: auth.userId },
        source: "api.v1.boxes.delete",
        trace_id,
        payload: {
          idempotency_key: `box-delete-release:${box.id}`,
          movement: {
            type: "asignacion_interna",
            amount: box.current_balance,
            currency: normalizeCurrency(account.currency),
            occurred_at: new Date().toISOString(),
            description: `Liberado desde caja ${box.name}`,
            merchant: null,
            category_id: null,
            subcategory_id: null,
            account_origin_id: null,
            account_destination_id: null,
            box_origin_id: box.id,
            box_destination_id: null,
            related_person_id: null,
            debt_id: null,
            recurring_rule_id: null,
            recurring_occurrence_id: null,
            source: "dashboard_manual",
            source_ref: `box:${box.id}:delete-release`,
            confidence: 1,
            requires_review: false,
            metadata: {
              reason: "box_delete_release",
              delete_reason: parsed.reason ?? null,
              box_id: box.id,
              account_id: account.id,
              trace_id,
            },
          },
        },
      });

      releaseMovement =
        result.type === "movement_created" ? result.movement : null;
    }

    await softDeleteBox(serviceClient, auth.userId, box.id);

    return okJson(
      {
        box_id: box.id,
        released_amount: box.current_balance,
        release_movement: releaseMovement,
      },
      meta
    );
  } catch (error) {
    if (error instanceof CoreError) return coreError(error, meta);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function normalizeCurrency(currency: string): "PEN" | "USD" {
  return currency === "USD" ? "USD" : "PEN";
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
