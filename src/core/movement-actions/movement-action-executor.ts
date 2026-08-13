import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import {
  assertSystemActionAllowed,
  SystemActionRiskDeniedError,
} from "@/core/risk/system-action-gate";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import { logger } from "@/shared/telemetry/logger";
import type { Movement } from "@/shared/types/domain";
import type { MovementInput } from "@/shared/schemas/money";
import { formatMovementActionAmount } from "./movement-action-consequences";
import type { MovementActionExecutionResult } from "./movement-action-execution-result";
import type { MovementActionCommand } from "./movement-action-proposal";

type Client = SupabaseClient<Database>;

/**
 * Ejecuta `restaurar_movimiento` o `duplicar_movimiento` ya confirmados.
 * Hermano de `debt-action-executor.ts` y `money-action-executor.ts`: arma o
 * reutiliza el comando y lo despacha por el `CommandDispatcher` real.
 *
 * `restore` reusa integro `RestoreMovementCommand`
 * (`command-dispatcher.ts:303-370`): ya valida que el movimiento este
 * eliminado y no revertido, y reconstruye el estado previo. Este ejecutor no
 * reescribe esa logica, solo la invoca.
 *
 * `duplicate` es logica nueva: no existia ningun camino que copiara un
 * movimiento. Vuelve a leer el movimiento origen al confirmar —no confia en
 * lo que la propuesta vio hace hasta 15 minutos— y arma un `MovementInput`
 * nuevo sin `id`, sin `debt_id`/`recurring_rule_id`/`recurring_occurrence_id`
 * (el duplicado es independiente: no hereda el vinculo especializado del
 * original) y sin metadata de auditoria vieja.
 *
 * `baseRiskLevel: "medium"` para las dos: ninguna es irreversible (restaurar
 * se vuelve a eliminar, duplicar se elimina el duplicado) y ninguna es del
 * nivel de un cierre de deuda.
 */
export async function executeMovementActionCommand(params: {
  client: Client;
  userId: string;
  command: MovementActionCommand;
  movementSource: Movement["source"];
  source: string;
  traceId: string;
}): Promise<MovementActionExecutionResult> {
  const { command } = params;

  try {
    assertSystemActionAllowed({
      actionKind: "financial_write",
      baseRiskLevel: "medium",
      explicitUserConfirmation: true,
      authenticatedSession: true,
      reversible: true,
    });

    const repository = new SupabaseFinancialCoreRepository(params.client);
    const dispatcher = new CommandDispatcher(repository);

    if (command.operation === "restore") {
      const result = await dispatcher.dispatch({
        type: "RestoreMovementCommand",
        command_id: randomUUID(),
        user_id: params.userId,
        actor: { type: "user", id: params.userId },
        source: params.source,
        trace_id: params.traceId,
        payload: {
          movement_id: command.payload.movement_id,
          reason: command.payload.reason,
        },
      });
      if (result.type !== "movement_restored") {
        return failure(command, "core_error", "MOVEMENT_ACTION_UNEXPECTED_RESULT", null);
      }
      return {
        kind: "applied",
        operation: "restore",
        catalog_command: command.catalog_command,
        entity_id: result.movement.id,
        summary: `el movimiento de ${formatMovementActionAmount(result.movement.amount, result.movement.currency)}${result.movement.description ? ` (${result.movement.description})` : ""}`,
        // `RestoreMovementCommand` no reporta idempotencia por si mismo: un
        // segundo envio sobre un movimiento ya restaurado (no eliminado)
        // devuelve `MOVEMENT_NOT_DELETED`, que se mapea abajo como conflicto,
        // no como exito repetido.
        idempotent: false,
      };
    }

    const source = await repository.getMovementById(
      params.userId,
      command.payload.source_movement_id,
    );
    if (!source) {
      return failure(
        command,
        "reference_not_found",
        "MOVEMENT_ACTION_SOURCE_NOT_FOUND",
        "No encontré el movimiento que quieres duplicar.",
      );
    }

    const duplicateInput: MovementInput = {
      type: source.type,
      amount: command.payload.amount,
      currency: source.currency,
      occurred_at: command.payload.occurred_at ?? new Date().toISOString(),
      description: source.description,
      merchant: source.merchant,
      category_id: source.category_id,
      subcategory_id: source.subcategory_id,
      account_origin_id: source.account_origin_id,
      account_destination_id: source.account_destination_id,
      box_origin_id: source.box_origin_id,
      box_destination_id: source.box_destination_id,
      related_person_id: source.related_person_id,
      // El duplicado es un movimiento nuevo e independiente: no arrastra el
      // vinculo especializado del original (`26` §14 sobre que se copia).
      debt_id: null,
      recurring_rule_id: null,
      recurring_occurrence_id: null,
      source: params.movementSource,
      source_ref: `movement_action:duplicate:${command.idempotency_key}`,
      confidence: 1,
      requires_review: false,
      metadata: { duplicated_from: source.id },
    };

    const dispatched = await dispatcher.dispatch({
      type: "CreateMovementCommand",
      command_id: randomUUID(),
      user_id: params.userId,
      actor: { type: "user", id: params.userId },
      source: params.source,
      trace_id: params.traceId,
      payload: {
        idempotency_key: command.idempotency_key,
        movement: duplicateInput,
      },
    });
    if (dispatched.type !== "movement_created") {
      return failure(command, "core_error", "MOVEMENT_ACTION_UNEXPECTED_RESULT", null);
    }

    return {
      kind: "applied",
      operation: "duplicate",
      catalog_command: command.catalog_command,
      entity_id: dispatched.movement.id,
      summary: `${formatMovementActionAmount(dispatched.movement.amount, dispatched.movement.currency)}${dispatched.movement.description ? ` (${dispatched.movement.description})` : ""}`,
      idempotent: dispatched.idempotent,
    };
  } catch (error) {
    if (error instanceof SystemActionRiskDeniedError) {
      return failure(command, "risk_policy", "MOVEMENT_ACTION_RISK_DENIED", null);
    }
    if (error instanceof CoreError) {
      return failure(
        command,
        error.code === "MOVEMENT_NOT_FOUND"
          ? "reference_not_found"
          : "conflict",
        error.code,
        error.message,
      );
    }
    logger.error("movement_action.execution_failed", {
      trace_id: params.traceId,
      operation: command.operation,
      catalog_command: command.catalog_command,
      error,
    });
    return failure(command, "core_error", "MOVEMENT_ACTION_CORE_ERROR", null);
  }
}

function failure(
  command: MovementActionCommand,
  reason: Extract<MovementActionExecutionResult, { kind: "failed" }>["reason"],
  errorCode: string,
  detail: string | null,
): MovementActionExecutionResult {
  return {
    kind: "failed",
    operation: command.operation,
    catalog_command: command.catalog_command,
    reason,
    error_code: errorCode,
    detail,
  };
}
