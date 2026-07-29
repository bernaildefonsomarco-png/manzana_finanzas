import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
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
import type { Account, Box, Movement } from "@/shared/types/domain";
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
  switch (params.action.action) {
    case "adjust_account_balance":
      return buildAdjustmentMovement({ ...params, action: params.action });
    case "transfer_between_accounts":
      return buildTransferMovement({ ...params, action: params.action });
    case "move_box_money":
      return buildBoxMovement({ ...params, action: params.action });
  }
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

  return movementInputBase({
    type: "ajuste",
    amount: Math.abs(delta),
    currency: normalizeCurrency(account.currency),
    description: `Ajuste de saldo de ${account.name}`,
    account_origin_id: delta < 0 ? account.id : null,
    account_destination_id: delta > 0 ? account.id : null,
    source_ref: buildMoneyActionSourceRef(
      params.action.action,
      params.idempotencyKey
    ),
    metadata: {
      reason: params.action.reason?.trim() || "dashboard_account_balance_adjustment",
      account_id: account.id,
      previous_balance: currentBalance,
      target_balance: targetBalance,
      delta,
      trace_id: params.traceId,
    },
  });
}

async function buildTransferMovement(params: {
  action: Extract<MoneyActionRequest, { action: "transfer_between_accounts" }>;
  userId: string;
  traceId: string;
  idempotencyKey: string;
  read: {
    getAccount: (accountId: string) => Promise<Account | null>;
  };
}): Promise<MovementInput> {
  const [fromAccount, toAccount] = await Promise.all([
    params.read.getAccount(params.action.from_account_id),
    params.read.getAccount(params.action.to_account_id),
  ]);

  if (!fromAccount || !toAccount) {
    throw new CoreError(
      "INVALID_MOVEMENT_ACCOUNTS",
      "No encontre una de las cuentas de la transferencia."
    );
  }

  if (normalizeCurrency(fromAccount.currency) !== normalizeCurrency(toAccount.currency)) {
    throw new CoreError(
      "INVALID_MOVEMENT_ACCOUNTS",
      "La transferencia entre monedas distintas queda fuera de V1."
    );
  }

  return movementInputBase({
    type: "transferencia",
    amount: params.action.amount,
    currency: normalizeCurrency(fromAccount.currency),
    description:
      params.action.description?.trim() ||
      `Transferencia de ${fromAccount.name} a ${toAccount.name}`,
    account_origin_id: fromAccount.id,
    account_destination_id: toAccount.id,
    source_ref: buildMoneyActionSourceRef(
      params.action.action,
      params.idempotencyKey
    ),
    metadata: {
      reason: "dashboard_account_transfer",
      from_account_id: fromAccount.id,
      to_account_id: toAccount.id,
      trace_id: params.traceId,
    },
  });
}

async function buildBoxMovement(params: {
  action: Extract<MoneyActionRequest, { action: "move_box_money" }>;
  userId: string;
  traceId: string;
  idempotencyKey: string;
  read: {
    getAccount: (accountId: string) => Promise<Account | null>;
    getBox: (boxId: string) => Promise<Box | null>;
    getFreeBalance: (accountId: string) => Promise<number>;
  };
}): Promise<MovementInput> {
  const originBox = params.action.box_origin_id
    ? await params.read.getBox(params.action.box_origin_id)
    : null;
  const destinationBox = params.action.box_destination_id
    ? await params.read.getBox(params.action.box_destination_id)
    : null;

  if (
    (params.action.mode === "release_from_box" || params.action.mode === "box_to_box") &&
    !originBox
  ) {
    throw new CoreError("INVALID_MOVEMENT_BOXES", "No encontre la caja origen.");
  }

  if (
    (params.action.mode === "separate_to_box" || params.action.mode === "box_to_box") &&
    !destinationBox
  ) {
    throw new CoreError("INVALID_MOVEMENT_BOXES", "No encontre la caja destino.");
  }

  if (
    originBox &&
    destinationBox &&
    originBox.account_id !== destinationBox.account_id
  ) {
    throw new CoreError(
      "INVALID_MOVEMENT_BOXES",
      "Mover dinero entre cajas de cuentas distintas queda fuera de V1."
    );
  }

  if (originBox && params.action.amount > Number(originBox.current_balance)) {
    throw new CoreError(
      "INVALID_MOVEMENT_BOXES",
      "No puedes mover mas de lo que hay separado en esa caja."
    );
  }

  const accountId = destinationBox?.account_id ?? originBox?.account_id;
  const account = accountId ? await params.read.getAccount(accountId) : null;
  if (!account) {
    throw new CoreError(
      "INVALID_MOVEMENT_ACCOUNTS",
      "No encontre la cuenta vinculada a la caja."
    );
  }

  // RUL-CUENTAS-06 / ERR-CUENTAS-04: separar dinero no puede dejar el libre
  // de la cuenta en negativo. `box_to_box` no lo necesita: redistribuye
  // saldo ya separado, no crea separacion nueva.
  if (params.action.mode === "separate_to_box") {
    const freeBalance = roundMoney(
      await params.read.getFreeBalance(account.id)
    );
    if (params.action.amount > freeBalance) {
      throw new CoreError(
        "INVALID_MOVEMENT_BOXES",
        `Solo tienes S/${freeBalance.toFixed(2)} libres en ${account.name}.`
      );
    }
  }

  return movementInputBase({
    type: "asignacion_interna",
    amount: params.action.amount,
    currency: normalizeCurrency(account.currency),
    description:
      params.action.description?.trim() ||
      buildBoxDescription(params.action.mode, originBox, destinationBox),
    box_origin_id: originBox?.id ?? null,
    box_destination_id: destinationBox?.id ?? null,
    source_ref: buildMoneyActionSourceRef(
      params.action.action,
      params.idempotencyKey
    ),
    metadata: {
      reason: boxModeReason(params.action.mode),
      account_id: account.id,
      box_origin_id: originBox?.id ?? null,
      box_destination_id: destinationBox?.id ?? null,
      trace_id: params.traceId,
    },
  });
}

function movementInputBase(params: {
  type: Movement["type"];
  amount: number;
  currency: "PEN" | "USD";
  description: string;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
  box_origin_id?: string | null;
  box_destination_id?: string | null;
  source_ref: string;
  metadata: Record<string, unknown>;
}): MovementInput {
  return {
    type: params.type,
    amount: roundMoney(params.amount),
    currency: params.currency,
    occurred_at: new Date().toISOString(),
    description: params.description,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    account_origin_id: params.account_origin_id ?? null,
    account_destination_id: params.account_destination_id ?? null,
    box_origin_id: params.box_origin_id ?? null,
    box_destination_id: params.box_destination_id ?? null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: "dashboard_manual",
    source_ref: params.source_ref,
    confidence: 1,
    requires_review: false,
    metadata: params.metadata,
  };
}

function buildBoxDescription(
  mode: Extract<MoneyActionRequest, { action: "move_box_money" }>["mode"],
  originBox: Box | null,
  destinationBox: Box | null
): string {
  if (mode === "separate_to_box") {
    return `Separado en caja ${destinationBox?.name ?? ""}`.trim();
  }

  if (mode === "release_from_box") {
    return `Liberado desde caja ${originBox?.name ?? ""}`.trim();
  }

  return `Movimiento de ${originBox?.name ?? "caja"} a ${
    destinationBox?.name ?? "caja"
  }`;
}

function boxModeReason(
  mode: Extract<MoneyActionRequest, { action: "move_box_money" }>["mode"]
): string {
  if (mode === "separate_to_box") return "dashboard_box_separate_money";
  if (mode === "release_from_box") return "dashboard_box_release_money";
  return "dashboard_box_transfer_money";
}

function normalizeCurrency(currency: string): "PEN" | "USD" {
  return currency === "USD" ? "USD" : "PEN";
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
