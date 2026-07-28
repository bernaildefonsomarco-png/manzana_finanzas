import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import { createServiceClient } from "@/data/supabase/server";
import {
  createBox,
  getAccountById,
  getActiveBoxes,
  getBoxById,
  softDeleteBox,
} from "@/data/repositories/accounts.repository";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
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
import {
  clampLimit,
  decodeCursor,
  paginateInMemory,
} from "@/app/api/_lib/pagination";
import { CreateBoxRequestSchema, ListBoxesQuerySchema } from "./schemas";

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
    const query = ListBoxesQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const boxes = await getActiveBoxes(auth.client, auth.userId, query.account_id);
    const { data: pageRows, page } = paginateInMemory(boxes, limit, cursor);

    return okJson({ boxes: pageRows }, { ...meta, page });
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

    const body = await readJsonBody(request);
    const parsed = CreateBoxRequestSchema.parse(body);
    const account = await getAccountById(auth.client, auth.userId, parsed.account_id);

    if (!account) {
      return errorJson(
        "NOT_FOUND",
        "No encontre esa cuenta para crear la caja.",
        meta,
        404
      );
    }

    const serviceClient = createServiceClient();
    let box = await createBox(serviceClient, {
      userId: auth.userId,
      accountId: account.id,
      name: parsed.name,
      type: parsed.type,
      targetAmount: parsed.target_amount ?? null,
      targetDate: parsed.target_date ?? null,
      metadata: {
        created_from: "dashboard_money",
        trace_id,
        initial_balance_requested: parsed.initial_balance,
      },
    });

    let allocationMovement: Movement | null = null;

    if (parsed.initial_balance > 0) {
      try {
        const repository = new SupabaseFinancialCoreRepository(serviceClient);
        const dispatcher = new CommandDispatcher(repository);
        const result = await dispatcher.dispatch({
          type: "CreateMovementCommand",
          command_id: randomUUID(),
          user_id: auth.userId,
          actor: { type: "user", id: auth.userId },
          source: "api.v1.boxes.post",
          trace_id,
          payload: {
            idempotency_key: `box-initial-allocation:${box.id}`,
            movement: {
              type: "asignacion_interna",
              amount: parsed.initial_balance,
              currency: normalizeCurrency(account.currency),
              occurred_at: new Date().toISOString(),
              description: `Separado en caja ${box.name}`,
              merchant: null,
              category_id: null,
              subcategory_id: null,
              account_origin_id: null,
              account_destination_id: null,
              box_origin_id: null,
              box_destination_id: box.id,
              related_person_id: null,
              debt_id: null,
              recurring_rule_id: null,
              recurring_occurrence_id: null,
              source: "dashboard_manual",
              source_ref: `box:${box.id}:initial-allocation`,
              confidence: 1,
              requires_review: false,
              metadata: {
                reason: "box_initial_allocation",
                box_id: box.id,
                account_id: account.id,
                trace_id,
              },
            },
          },
        });

        allocationMovement =
          result.type === "movement_created" ? result.movement : null;
      } catch (error) {
        await softDeleteBox(serviceClient, auth.userId, box.id).catch(() => {});
        throw error;
      }

      box = (await getBoxById(serviceClient, auth.userId, box.id)) ?? box;
    }

    return okJson({ box, allocation_movement: allocationMovement }, meta, {
      status: 201,
    });
  } catch (error) {
    if (error instanceof CoreError) return coreError(error, meta);
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
