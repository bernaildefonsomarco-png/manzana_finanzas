import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { Box, MovementSource } from "@/shared/types/domain";
import { CommandDispatcher } from "@/core/finance";
import { CoreError } from "@/core/finance/errors";
import {
  assertSystemActionAllowed,
  SystemActionRiskDeniedError,
} from "@/core/risk/system-action-gate";
import {
  createBox,
  getAccountById,
  getBoxById,
  getFreeBalanceForAccount,
  softDeleteBox,
  updateBoxMeta,
} from "@/data/repositories/accounts.repository";
import {
  BudgetOperationError,
  commitBudgetOperationForUser,
  commitGoalOperationForUser,
} from "@/data/repositories/budgets.repository";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import {
  appendStructureAudit,
  BOX_STRUCTURE_IDEMPOTENCY_METADATA_KEY,
  findBoxByStructureIdempotencyKey,
  isUniqueViolation,
  StructureRepositoryError,
} from "@/data/repositories/structure.repository";
import { logger } from "@/shared/telemetry/logger";
import {
  entityForCommandType,
  operationForCommandType,
  StructureCommandSchema,
  type StructureCommand,
  type StructureEntity,
  type StructureOperation,
} from "./structure-commands";

type Client = SupabaseClient<Database>;

export type StructureExecutionResult =
  | {
      kind: "applied";
      entity: StructureEntity;
      operation: StructureOperation;
      entity_id: string;
      /** Frase corta y concreta de lo que quedo escrito. */
      summary: string;
      /** `true` cuando el comando ya se habia ejecutado con esta misma clave. */
      idempotent: boolean;
    }
  | {
      kind: "failed";
      entity: StructureEntity;
      operation: StructureOperation;
      reason:
        | "invalid_command"
        | "reference_not_found"
        | "conflict"
        | "insufficient_free_balance"
        | "risk_policy"
        | "core_error";
      error_code: string;
      /** Detalle listo para mostrar cuando el motivo es del usuario, no del sistema. */
      detail: string | null;
    };

/**
 * Ejecuta un comando de estructura ya confirmado por el usuario
 * (`RUL-ESTR-01`).
 *
 * Es el hermano de `CommandDispatcher` para el dominio de estructura, no una
 * extension suya: cada entidad se escribe con el ejecutor transaccional que ya
 * tiene (los RPC `commit_*_operation` para metas y presupuestos, la tabla
 * `boxes` con su unicidad para cajas), y lo unico que vuelve al motor de
 * movimientos es el dinero que una caja aparta.
 *
 * Nunca se llama sin confirmacion explicita: quien lo invoca ya resolvio el
 * boton `estr:<uuid>` o el "si" equivalente del mismo hilo.
 */
export async function executeStructureCommand(params: {
  client: Client;
  command: StructureCommand;
  /**
   * Origen que llevara el movimiento de asignacion interna si la caja aparta
   * dinero. Viene del llamador porque el nucleo no sabe por que canal entro el
   * turno (`AC-INV-04`).
   */
  movementSource: MovementSource;
}): Promise<StructureExecutionResult> {
  const parsed = StructureCommandSchema.safeParse(params.command);
  if (!parsed.success) {
    return {
      kind: "failed",
      entity: entityForCommandType(params.command.type),
      operation: operationForCommandType(params.command.type),
      reason: "invalid_command",
      error_code: "STRUCTURE_COMMAND_INVALID",
      detail: null,
    };
  }

  const command = parsed.data;
  const entity = entityForCommandType(command.type);
  const operation = operationForCommandType(command.type);

  try {
    // La confirmacion ya ocurrio antes de llegar aqui; el gate deja constancia
    // de que esta escritura es reversible y explicita, igual que una
    // correccion.
    assertSystemActionAllowed({
      actionKind: "financial_write",
      baseRiskLevel: "medium",
      explicitUserConfirmation: true,
      authenticatedSession: true,
      reversible: true,
    });

    switch (command.type) {
      case "CreateBoxCommand":
        return await createBoxFromCommand(
          params.client,
          command,
          params.movementSource,
        );
      case "UpdateBoxCommand":
        return await updateBoxFromCommand(params.client, command);
      case "CreateGoalCommand":
        return await commitGoal(params.client, command, "create");
      case "UpdateGoalCommand":
        return await commitGoal(params.client, command, "update");
      case "CreateBudgetCommand":
        return await commitBudget(params.client, command, "create");
      case "UpdateBudgetCommand":
        return await commitBudget(params.client, command, "update");
    }
  } catch (error) {
    return failureFromError({ error, entity, operation, command });
  }
}

// --- Caja -----------------------------------------------------------------

async function createBoxFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "CreateBoxCommand" }>,
  movementSource: MovementSource,
): Promise<StructureExecutionResult> {
  const payload = command.payload;

  const alreadyCreated = await findBoxByStructureIdempotencyKey(
    client,
    command.user_id,
    command.idempotency_key,
  );
  if (alreadyCreated) {
    return {
      kind: "applied",
      entity: "caja",
      operation: "create",
      entity_id: alreadyCreated.id,
      summary: describeBox(alreadyCreated),
      idempotent: true,
    };
  }

  const account = await getAccountById(
    client,
    command.user_id,
    payload.account_id,
  );
  if (!account) {
    return {
      kind: "failed",
      entity: "caja",
      operation: "create",
      reason: "reference_not_found",
      error_code: "ACCOUNT_NOT_FOUND",
      detail: "No encontré esa cuenta para crear la caja.",
    };
  }

  // `RUL-CUENTAS-06`/`ERR-CUENTAS-04`: apartar dinero al crear la caja no puede
  // dejar el libre de la cuenta en negativo.
  if (payload.initial_balance > 0) {
    const freeBalance = roundMoney(
      await getFreeBalanceForAccount(client, command.user_id, account.id),
    );
    if (payload.initial_balance > freeBalance) {
      return {
        kind: "failed",
        entity: "caja",
        operation: "create",
        reason: "insufficient_free_balance",
        error_code: "INSUFFICIENT_FREE_BALANCE",
        detail: `Solo tienes S/${freeBalance.toFixed(2)} libres en ${account.name}.`,
      };
    }
  }

  let box: Box;
  try {
    box = await createBox(client, {
      userId: command.user_id,
      accountId: account.id,
      name: payload.name,
      type: payload.type,
      targetAmount: payload.target_amount,
      targetDate: payload.target_date,
      metadata: {
        created_from: "conversational_structure",
        [BOX_STRUCTURE_IDEMPOTENCY_METADATA_KEY]: command.idempotency_key,
        trace_id: command.trace_id,
        command_id: command.command_id,
        initial_balance_requested: payload.initial_balance,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        kind: "failed",
        entity: "caja",
        operation: "create",
        reason: "conflict",
        error_code: "BOX_NAME_TAKEN",
        detail: `Ya tienes una caja "${payload.name}" activa en ${account.name}.`,
      };
    }
    throw error;
  }

  if (payload.initial_balance > 0) {
    try {
      const dispatcher = new CommandDispatcher(
        new SupabaseFinancialCoreRepository(client),
      );
      await dispatcher.dispatch({
        type: "CreateMovementCommand",
        command_id: randomUUID(),
        user_id: command.user_id,
        actor: command.actor,
        source: command.source,
        trace_id: command.trace_id,
        payload: {
          // Misma clave que usa la pantalla: el dinero apartado de una caja
          // concreta solo puede registrarse una vez.
          idempotency_key: `box-initial-allocation:${box.id}`,
          movement: {
            type: "asignacion_interna",
            amount: payload.initial_balance,
            currency: account.currency === "USD" ? "USD" : "PEN",
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
            source: movementSource,
            source_ref: `box:${box.id}:initial-allocation`,
            confidence: 1,
            requires_review: false,
            metadata: {
              reason: "box_initial_allocation",
              box_id: box.id,
              account_id: account.id,
              trace_id: command.trace_id,
            },
          },
        },
      });
    } catch (error) {
      // El dinero no se movio: la caja a medias seria peor que no tenerla.
      await softDeleteBox(client, command.user_id, box.id).catch(() => {});
      throw error;
    }

    box = (await getBoxById(client, command.user_id, box.id)) ?? box;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "box",
    entityId: box.id,
    action: "created",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: null,
    newValue: box,
  });

  return {
    kind: "applied",
    entity: "caja",
    operation: "create",
    entity_id: box.id,
    summary: describeBox(box),
    idempotent: false,
  };
}

async function updateBoxFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "UpdateBoxCommand" }>,
): Promise<StructureExecutionResult> {
  const { box_id: boxId, ...changes } = command.payload;
  const previous = await getBoxById(client, command.user_id, boxId);
  if (!previous) {
    return {
      kind: "failed",
      entity: "caja",
      operation: "update",
      reason: "reference_not_found",
      error_code: "BOX_NOT_FOUND",
      detail: "No encontré esa caja.",
    };
  }

  // Idempotencia por estado: si lo que se pide ya es lo que hay, el segundo
  // envio no vuelve a escribir ni a anotar auditoria.
  const alreadyApplied = (
    Object.keys(changes) as Array<keyof typeof changes>
  ).every((field) => previous[field] === changes[field]);
  if (alreadyApplied) {
    return {
      kind: "applied",
      entity: "caja",
      operation: "update",
      entity_id: previous.id,
      summary: describeBox(previous),
      idempotent: true,
    };
  }

  let updated: Box;
  try {
    updated = await updateBoxMeta(client, command.user_id, boxId, changes);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        kind: "failed",
        entity: "caja",
        operation: "update",
        reason: "conflict",
        error_code: "BOX_NAME_TAKEN",
        detail: "Ya tienes otra caja activa con ese nombre en esa cuenta.",
      };
    }
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "box",
    entityId: updated.id,
    action: "updated",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: previous,
    newValue: updated,
  });

  return {
    kind: "applied",
    entity: "caja",
    operation: "update",
    entity_id: updated.id,
    summary: describeBox(updated),
    idempotent: false,
  };
}

// --- Meta -----------------------------------------------------------------

async function commitGoal(
  client: Client,
  command: Extract<
    StructureCommand,
    { type: "CreateGoalCommand" | "UpdateGoalCommand" }
  >,
  operation: StructureOperation,
): Promise<StructureExecutionResult> {
  const { goalId, payload } = splitGoalPayload(command);
  const result = await commitGoalOperationForUser(client, {
    userId: command.user_id,
    operation,
    goalId,
    payload,
    idempotencyKey: command.idempotency_key,
    traceId: command.trace_id,
  });

  if (!result.idempotent) {
    await appendStructureAudit(client, {
      userId: command.user_id,
      entityType: "goal",
      entityId: result.goal.id,
      action: operation === "create" ? "created" : "updated",
      actorType: command.actor.type,
      actorId: command.actor.id,
      source: command.source,
      traceId: command.trace_id,
      commandId: command.command_id,
      idempotencyKey: command.idempotency_key,
      oldValue: null,
      newValue: result.goal,
    });
  }

  return {
    kind: "applied",
    entity: "meta",
    operation,
    entity_id: result.goal.id,
    summary: `la meta ${result.goal.name} de ${formatMoney(result.goal.target_amount)}`,
    idempotent: result.idempotent,
  };
}

// --- Presupuesto ----------------------------------------------------------

async function commitBudget(
  client: Client,
  command: Extract<
    StructureCommand,
    { type: "CreateBudgetCommand" | "UpdateBudgetCommand" }
  >,
  operation: StructureOperation,
): Promise<StructureExecutionResult> {
  const { budgetId, payload } = splitBudgetPayload(command);
  const result = await commitBudgetOperationForUser(client, {
    userId: command.user_id,
    operation,
    budgetId,
    payload,
    idempotencyKey: command.idempotency_key,
    traceId: command.trace_id,
  });

  const budget = result.budget;
  if (!budget) {
    return {
      kind: "failed",
      entity: "presupuesto",
      operation,
      reason: "core_error",
      error_code: "BUDGET_OPERATION_EMPTY",
      detail: null,
    };
  }

  if (!result.idempotent) {
    await appendStructureAudit(client, {
      userId: command.user_id,
      entityType: "budget",
      entityId: budget.id,
      action: operation === "create" ? "created" : "updated",
      actorType: command.actor.type,
      actorId: command.actor.id,
      source: command.source,
      traceId: command.trace_id,
      commandId: command.command_id,
      idempotencyKey: command.idempotency_key,
      oldValue: null,
      newValue: budget,
    });
  }

  return {
    kind: "applied",
    entity: "presupuesto",
    operation,
    entity_id: budget.id,
    // `RUL-PRES-01`: se nombra como referencia, nunca como dinero apartado.
    summary: `un presupuesto de ${formatMoney(budget.amount)} ${periodLabel(budget.period_kind)}`,
    idempotent: result.idempotent,
  };
}

// --- Helpers --------------------------------------------------------------

function splitGoalPayload(
  command: Extract<
    StructureCommand,
    { type: "CreateGoalCommand" | "UpdateGoalCommand" }
  >,
): { goalId: string | null; payload: Record<string, unknown> } {
  if (command.type === "CreateGoalCommand") {
    return { goalId: null, payload: { ...command.payload } };
  }
  const { goal_id: goalId, ...rest } = command.payload;
  return { goalId, payload: { ...rest } };
}

function splitBudgetPayload(
  command: Extract<
    StructureCommand,
    { type: "CreateBudgetCommand" | "UpdateBudgetCommand" }
  >,
): { budgetId: string | null; payload: Record<string, unknown> } {
  if (command.type === "CreateBudgetCommand") {
    return { budgetId: null, payload: { ...command.payload, source: "manual" } };
  }
  const { budget_id: budgetId, ...rest } = command.payload;
  return { budgetId, payload: { ...rest } };
}

function failureFromError(input: {
  error: unknown;
  entity: StructureEntity;
  operation: StructureOperation;
  command: StructureCommand;
}): StructureExecutionResult {
  const { error, entity, operation } = input;

  if (error instanceof SystemActionRiskDeniedError) {
    return {
      kind: "failed",
      entity,
      operation,
      reason: "risk_policy",
      error_code: error.message,
      detail: null,
    };
  }

  if (error instanceof BudgetOperationError) {
    const isNotFound =
      error.code === "BUDGET_NOT_FOUND" || error.code === "GOAL_NOT_FOUND";
    return {
      kind: "failed",
      entity,
      operation,
      reason: isNotFound ? "reference_not_found" : "conflict",
      error_code: error.code,
      detail: error.message,
    };
  }

  if (error instanceof StructureRepositoryError) {
    return {
      kind: "failed",
      entity,
      operation,
      reason: "core_error",
      error_code: error.code,
      detail: null,
    };
  }

  logger.error("structure.execution_failed", {
    error,
    entity,
    operation,
    trace_id: input.command.trace_id,
  });

  return {
    kind: "failed",
    entity,
    operation,
    reason: "core_error",
    error_code: error instanceof CoreError ? error.code : "STRUCTURE_CORE_ERROR",
    detail: null,
  };
}

function describeBox(box: Box): string {
  const balance = formatMoney(box.current_balance);
  return box.current_balance > 0
    ? `la caja ${box.name} con ${balance} apartados`
    : `la caja ${box.name}`;
}

function periodLabel(periodKind: string): string {
  if (periodKind === "semanal") return "por semana";
  if (periodKind === "quincenal") return "por quincena";
  return "al mes";
}

function formatMoney(amount: number): string {
  return `S/${amount.toFixed(2)}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
