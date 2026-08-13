import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import {
  buildBoxMovement as buildBoxMovementCore,
  buildTransferMovement as buildTransferMovementCore,
  normalizeCurrency,
  roundMoney,
} from "@/core/finance/money-action-movements";
import {
  getAccountById,
  getBoxById,
  getFreeBalanceForAccount,
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
import { readIdempotencyKey } from "@/app/api/_lib/idempotency";
import type { Account, Box } from "@/shared/types/domain";
import type { MovementInput } from "@/shared/schemas/money";
import {
  MoneyActionRequestSchema,
  type MoneyActionRequest,
} from "./schemas";
import { buildMoneyActionSourceRef } from "./source-ref";

export const dynamic = "force-dynamic";

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
        "Idempotency-Key invalida para ejecutar la accion.",
        meta,
        400
      );
    }

    const body = await readJsonBody(request);
    const parsed = MoneyActionRequestSchema.parse(body);
    const movement = await buildMovementForAction({
      action: parsed,
      userId: auth.userId,
      traceId: trace_id,
      idempotencyKey,
      read: {
        getAccount: (accountId) =>
          getAccountById(auth.client, auth.userId, accountId),
        getBox: (boxId) => getBoxById(auth.client, auth.userId, boxId),
        getFreeBalance: (accountId) =>
          getFreeBalanceForAccount(auth.client, auth.userId, accountId),
      },
    });

    const serviceClient = createServiceClient();
    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(serviceClient)
    );
    const result = await dispatcher.dispatch({
      type: "CreateMovementCommand",
      command_id: randomUUID(),
      user_id: auth.userId,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.money.actions.post",
      trace_id,
      payload: {
        idempotency_key: idempotencyKey,
        movement,
      },
    });

    const status =
      result.type === "movement_created" && result.idempotent ? 200 : 201;

    return okJson(
      {
        action: parsed.action,
        movement: result.movement,
        idempotent:
          result.type === "movement_created" ? result.idempotent : false,
      },
      meta,
      { status }
    );
  } catch (error) {
    if (error instanceof CoreError) return coreError(error, meta);
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

async function buildMovementForAction(params: {
  action: MoneyActionRequest;
  userId: string;
  traceId: string;
  idempotencyKey: string;
  read: {
    getAccount: (accountId: string) => Promise<Account | null>;
    getBox: (boxId: string) => Promise<Box | null>;
    getFreeBalance: (accountId: string) => Promise<number>;
  };
}): Promise<MovementInput> {
  const now = new Date().toISOString();

  switch (params.action.action) {
    case "adjust_account_balance":
      return buildAdjustmentMovement({ ...params, action: params.action });
    case "transfer_between_accounts":
      return buildTransferMovementCore({
        action: params.action,
        now,
        sourceRef: buildMoneyActionSourceRef(
          params.action.action,
          params.idempotencyKey
        ),
        metadata: {
          reason: "dashboard_account_transfer",
          trace_id: params.traceId,
        },
        movementSource: "dashboard_manual",
        read: params.read,
      });
    case "move_box_money":
      return buildBoxMovementCore({
        action: params.action,
        now,
        sourceRef: buildMoneyActionSourceRef(
          params.action.action,
          params.idempotencyKey
        ),
        metadata: {
          reason: `dashboard_${boxModeReasonForRoute(params.action.mode)}`,
          trace_id: params.traceId,
        },
        movementSource: "dashboard_manual",
        read: params.read,
      });
  }
}

function boxModeReasonForRoute(
  mode: Extract<MoneyActionRequest, { action: "move_box_money" }>["mode"]
): string {
  if (mode === "separate_to_box") return "box_separate_money";
  if (mode === "release_from_box") return "box_release_money";
  return "box_transfer_money";
}

async function buildAdjustmentMovement(params: {
  action: Extract<MoneyActionRequest, { action: "adjust_account_balance" }>;
  userId: string;
  traceId: string;
  idempotencyKey: string;
  read: {
    getAccount: (accountId: string) => Promise<Account | null>;
  };
}): Promise<MovementInput> {
  const account = await params.read.getAccount(params.action.account_id);
  if (!account) {
    throw new CoreError("MOVEMENT_NOT_FOUND", "No encontre esa cuenta.");
  }

  const currentBalance = roundMoney(Number(account.current_balance));
  const targetBalance = roundMoney(params.action.target_balance);
  const delta = roundMoney(targetBalance - currentBalance);

  if (Math.abs(delta) < 0.01) {
    throw new CoreError(
      "INVALID_ADJUSTMENT",
      "Ese saldo ya coincide con la cuenta."
    );
  }

  return {
    type: "ajuste",
    amount: roundMoney(Math.abs(delta)),
    currency: normalizeCurrency(account.currency),
    occurred_at: new Date().toISOString(),
    description: `Ajuste de saldo de ${account.name}`,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    account_origin_id: delta < 0 ? account.id : null,
    account_destination_id: delta > 0 ? account.id : null,
    box_origin_id: null,
    box_destination_id: null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: "dashboard_manual",
    source_ref: buildMoneyActionSourceRef(
      params.action.action,
      params.idempotencyKey
    ),
    confidence: 1,
    requires_review: false,
    metadata: {
      reason: params.action.reason?.trim() || "dashboard_account_balance_adjustment",
      account_id: account.id,
      previous_balance: currentBalance,
      target_balance: targetBalance,
      delta,
      trace_id: params.traceId,
    },
  };
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
