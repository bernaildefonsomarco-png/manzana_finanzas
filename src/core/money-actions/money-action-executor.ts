import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import {
  buildBoxMovement,
  buildTransferMovement,
} from "@/core/finance/money-action-movements";
import {
  assertSystemActionAllowed,
  SystemActionRiskDeniedError,
} from "@/core/risk/system-action-gate";
import {
  getAccountById,
  getBoxById,
  getFreeBalanceForAccount,
} from "@/data/repositories/accounts.repository";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import { logger } from "@/shared/telemetry/logger";
import type { Account, Box, Movement } from "@/shared/types/domain";
import { formatMoneyActionAmount } from "./money-action-consequences";
import type { MoneyActionExecutionResult } from "./money-action-execution-result";
import type { MoneyActionCommand } from "./money-action-proposal";

type Client = SupabaseClient<Database>;

/**
 * Ejecuta un movimiento de dinero entre cuentas o cajas ya confirmado por el
 * usuario (`24` §9). Es hermano de `debt-action-executor.ts`, no una
 * extension: arma el `MovementInput` con las MISMAS funciones puras que usa la
 * ruta HTTP (`money-action-movements.ts`) y lo despacha por el
 * `CommandDispatcher` real, igual que `crear_movimiento`.
 *
 * `baseRiskLevel: "medium"`: mueve dinero real, pero entre cuentas y cajas del
 * propio usuario y siempre reversible (transferir de vuelta, devolver lo
 * separado, mover al reves — `24` §9 columna "Deshacer"). No es del nivel de
 * `cerrar_deuda`, que escribe en el historial que un dinero no se pagó y no
 * tiene un "deshacer" de un solo paso.
 */
export async function executeMoneyActionCommand(params: {
  client: Client;
  userId: string;
  command: MoneyActionCommand;
  movementSource: Movement["source"];
  source: string;
  traceId: string;
}): Promise<MoneyActionExecutionResult> {
  const { command } = params;

  try {
    assertSystemActionAllowed({
      actionKind: "financial_write",
      baseRiskLevel: "medium",
      explicitUserConfirmation: true,
      authenticatedSession: true,
      reversible: true,
    });

    const accountCache = new Map<string, Account | null>();
    const boxCache = new Map<string, Box | null>();
    const getAccount = async (accountId: string) => {
      if (!accountCache.has(accountId)) {
        accountCache.set(
          accountId,
          await getAccountById(params.client, params.userId, accountId),
        );
      }
      return accountCache.get(accountId) ?? null;
    };
    const getBox = async (boxId: string) => {
      if (!boxCache.has(boxId)) {
        boxCache.set(
          boxId,
          await getBoxById(params.client, params.userId, boxId),
        );
      }
      return boxCache.get(boxId) ?? null;
    };

    const now = new Date().toISOString();
    const sourceRef = `money_action:${command.operation}:${command.idempotency_key}`;
    const metadata = { reason: `assistant_${command.operation}`, trace_id: params.traceId };

    const movement =
      command.operation === "transfer"
        ? await buildTransferMovement({
            action: command.payload,
            now,
            sourceRef,
            metadata,
            movementSource: params.movementSource,
            read: { getAccount },
          })
        : await buildBoxMovement({
            action: {
              mode: command.operation,
              ...command.payload,
            },
            now,
            sourceRef,
            metadata,
            movementSource: params.movementSource,
            read: {
              getAccount,
              getBox,
              getFreeBalance: (accountId) =>
                getFreeBalanceForAccount(params.client, params.userId, accountId),
            },
          });

    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(params.client),
    );
    const result = await dispatcher.dispatch({
      type: "CreateMovementCommand",
      command_id: randomUUID(),
      user_id: params.userId,
      actor: { type: "user", id: params.userId },
      source: params.source,
      trace_id: params.traceId,
      payload: {
        idempotency_key: command.idempotency_key,
        movement,
      },
    });

    if (result.type !== "movement_created") {
      // `CreateMovementCommand` siempre devuelve `movement_created`; esta
      // rama solo protege el tipo, nunca deberia alcanzarse en produccion.
      return failure(
        command,
        "core_error",
        "MONEY_ACTION_UNEXPECTED_RESULT",
        null,
      );
    }

    return {
      kind: "applied",
      operation: command.operation,
      catalog_command: command.catalog_command,
      entity_id: result.movement.id,
      summary: buildAppliedSummary({
        command,
        currency: result.movement.currency,
        accountCache,
        boxCache,
      }),
      idempotent: result.idempotent,
    };
  } catch (error) {
    if (error instanceof SystemActionRiskDeniedError) {
      return failure(command, "risk_policy", "MONEY_ACTION_RISK_DENIED", null);
    }
    if (error instanceof CoreError) {
      return failure(
        command,
        error.code === "MOVEMENT_NOT_FOUND" ? "reference_not_found" : "conflict",
        error.code,
        error.message,
      );
    }
    logger.error("money_action.execution_failed", {
      trace_id: params.traceId,
      operation: command.operation,
      catalog_command: command.catalog_command,
      error,
    });
    return failure(command, "core_error", "MONEY_ACTION_CORE_ERROR", null);
  }
}

function buildAppliedSummary(params: {
  command: MoneyActionCommand;
  currency: "PEN" | "USD";
  accountCache: Map<string, Account | null>;
  boxCache: Map<string, Box | null>;
}): string {
  const { command, currency, accountCache, boxCache } = params;
  const cifra = formatMoneyActionAmount(command.payload.amount, currency);

  if (command.operation === "transfer") {
    const from = accountCache.get(command.payload.from_account_id)?.name ?? "tu cuenta";
    const to = accountCache.get(command.payload.to_account_id)?.name ?? "la otra cuenta";
    return `${cifra} de ${from} a ${to}`;
  }
  if (command.operation === "separate_to_box") {
    const box = boxCache.get(command.payload.box_destination_id)?.name ?? "la caja";
    return `${cifra} separados en ${box}`;
  }
  if (command.operation === "release_from_box") {
    const box = boxCache.get(command.payload.box_origin_id)?.name ?? "la caja";
    return `${cifra} devueltos de ${box} a libre`;
  }
  const origin = boxCache.get(command.payload.box_origin_id)?.name ?? "la caja de origen";
  const destination =
    boxCache.get(command.payload.box_destination_id)?.name ?? "la caja de destino";
  return `${cifra} de ${origin} a ${destination}`;
}

function failure(
  command: MoneyActionCommand,
  reason: Extract<MoneyActionExecutionResult, { kind: "failed" }>["reason"],
  errorCode: string,
  detail: string | null,
): MoneyActionExecutionResult {
  return {
    kind: "failed",
    operation: command.operation,
    catalog_command: command.catalog_command,
    reason,
    error_code: errorCode,
    detail,
  };
}
