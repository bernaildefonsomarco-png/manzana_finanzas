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
import type { SystemActionKind } from "@/core/risk/risk-policy";
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
  archiveAccountFromCommand,
  createAccountFromCommand,
  updateAccountFromCommand,
} from "./account-executor";
import {
  changeRecurringStatusFromCommand,
  createRecurringFromCommand,
  updateRecurringFromCommand,
} from "./recurring-executor";
import {
  archiveSubcategoryFromCommand,
  createSubcategoryFromCommand,
  updateSubcategoryFromCommand,
} from "./subcategory-executor";
import {
  entityForCommandType,
  isDestructiveStructureOperation,
  operationForCommandType,
  StructureCommandSchema,
  type StructureCommand,
  type StructureEntity,
  type StructureOperation,
} from "./structure-commands";
import {
  formatMoney,
  type StructureExecutionResult,
} from "./structure-execution-result";

type Client = SupabaseClient<Database>;

export type { StructureExecutionResult };

/**
 * Ejecuta un comando de estructura ya confirmado por el usuario
 * (`RUL-ESTR-01`).
 *
 * Es el hermano de `CommandDispatcher` para el dominio de estructura, no una
 * extension suya: cada entidad se escribe con el ejecutor que ya tiene —los
 * RPC `commit_*_operation` para metas y presupuestos; las tablas `boxes`,
 * `recurring_rules` y `accounts`, cada una con su propia red dura de unicidad e
 * idempotencia— y lo unico que vuelve al motor de movimientos es el dinero que
 * una caja aparta o devuelve.
 *
 * Nunca se llama sin confirmacion explicita: quien lo invoca ya resolvio el
 * boton `estr:<uuid>` o el "si" equivalente del mismo hilo.
 */
export async function executeStructureCommand(params: {
  client: Client;
  command: StructureCommand;
  /**
   * Origen que llevara el movimiento de asignacion interna si la caja aparta o
   * devuelve dinero. Viene del llamador porque el nucleo no sabe por que canal
   * entro el turno (`AC-INV-04`).
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
    // del tipo de accion y de que fue explicita.
    assertSystemActionAllowed({
      actionKind: actionKindFor(entity, operation),
      baseRiskLevel: isDestructiveStructureOperation(operation)
        ? "high"
        : "medium",
      explicitUserConfirmation: true,
      authenticatedSession: true,
      // Archivar es un borrado logico: la fila sigue ahi y hay camino de
      // vuelta. Declararlo irreversible obligaria a una segunda confirmacion
      // que el usuario ya dio.
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
      case "ArchiveBoxCommand":
        return await archiveBoxFromCommand(
          params.client,
          command,
          params.movementSource,
        );
      case "CreateGoalCommand":
        return await commitGoal(params.client, command, "create");
      case "UpdateGoalCommand":
        return await commitGoal(params.client, command, "update");
      case "ArchiveGoalCommand":
        return await commitGoal(params.client, command, "archive");
      case "PauseGoalCommand":
        return await commitGoal(params.client, command, "pause");
      case "ResumeGoalCommand":
        return await commitGoal(params.client, command, "resume");
      case "CreateBudgetCommand":
        return await commitBudget(params.client, command, "create");
      case "UpdateBudgetCommand":
        return await commitBudget(params.client, command, "update");
      case "ArchiveBudgetCommand":
        return await commitBudget(params.client, command, "archive");
      case "PauseBudgetCommand":
        return await commitBudget(params.client, command, "pause");
      case "ResumeBudgetCommand":
        return await commitBudget(params.client, command, "resume");
      case "CreateRecurringCommand":
        return await createRecurringFromCommand(params.client, command);
      case "UpdateRecurringCommand":
        return await updateRecurringFromCommand(params.client, command);
      case "ArchiveRecurringCommand":
      case "PauseRecurringCommand":
      case "ResumeRecurringCommand":
        return await changeRecurringStatusFromCommand(params.client, command);
      case "CreateAccountCommand":
        return await createAccountFromCommand(params.client, command);
      case "UpdateAccountCommand":
        return await updateAccountFromCommand(params.client, command);
      case "ArchiveAccountCommand":
        return await archiveAccountFromCommand(params.client, command);
      case "CreateSubcategoryCommand":
        return await createSubcategoryFromCommand(params.client, command);
      case "UpdateSubcategoryCommand":
        return await updateSubcategoryFromCommand(params.client, command);
      case "ArchiveSubcategoryCommand":
        return await archiveSubcategoryFromCommand(params.client, command);
    }
  } catch (error) {
    return failureFromError({ error, entity, operation, command });
  }
}

/**
 * El gate distingue tres clases de escritura de estructura, y la distincion no
 * es cosmetica: decide el nivel de riesgo con el que queda anotada.
 *
 *  - archivar es `destructive_financial_write`;
 *  - cualquier cambio sobre una regla recurrente es `recurring_activation`,
 *    porque cambia el comportamiento futuro del sistema;
 *  - el resto es una escritura financiera normal.
 *
 * Una subcategoria no mueve ni un centavo, pero cae en la misma clasificacion
 * que las demas a proposito: el gate no mide dinero, mide que la escritura
 * quede anotada con su actor, su confirmacion explicita y su nivel. Inventarle
 * una clase propia solo para bajarle el riesgo la sacaria de ese rastro.
 */
function actionKindFor(
  entity: StructureEntity,
  operation: StructureOperation,
): SystemActionKind {
  if (isDestructiveStructureOperation(operation)) {
    return "destructive_financial_write";
  }
  if (entity === "recurrente") return "recurring_activation";
  return "financial_write";
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
      await moveBoxMoney(client, {
        userId: command.user_id,
        actor: command.actor,
        source: command.source,
        traceId: command.trace_id,
        amount: payload.initial_balance,
        currency: account.currency === "USD" ? "USD" : "PEN",
        // Misma clave que usa la pantalla: el dinero apartado de una caja
        // concreta solo puede registrarse una vez.
        idempotencyKey: `box-initial-allocation:${box.id}`,
        description: `Separado en caja ${box.name}`,
        sourceRef: `box:${box.id}:initial-allocation`,
        boxOriginId: null,
        boxDestinationId: box.id,
        movementSource,
        metadata: {
          reason: "box_initial_allocation",
          box_id: box.id,
          account_id: account.id,
          trace_id: command.trace_id,
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

/**
 * Archiva una caja con la misma semantica que `DELETE /api/v1/boxes/[id]`: el
 * dinero apartado **vuelve a lo libre de su cuenta** por un movimiento de
 * `asignacion_interna` —el motor de saldos sigue siendo el unico que mueve
 * plata— y despues la caja se marca como borrada.
 *
 * El orden importa y no es simetrico al de crear: primero se devuelve el
 * dinero y luego se archiva. Si el archivado fallara despues de devolver, el
 * usuario ve una caja vacia, que es raro pero honesto; al reves veria dinero
 * desaparecido.
 */
async function archiveBoxFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "ArchiveBoxCommand" }>,
  movementSource: MovementSource,
): Promise<StructureExecutionResult> {
  const boxId = command.payload.box_id;
  const previous = await getBoxById(client, command.user_id, boxId);
  if (!previous) {
    return {
      kind: "failed",
      entity: "caja",
      operation: "archive",
      reason: "reference_not_found",
      error_code: "BOX_NOT_FOUND",
      detail: "No encontré esa caja.",
    };
  }

  const account = await getAccountById(
    client,
    command.user_id,
    previous.account_id,
  );
  if (!account) {
    return {
      kind: "failed",
      entity: "caja",
      operation: "archive",
      reason: "conflict",
      error_code: "BOX_ACCOUNT_UNAVAILABLE",
      detail:
        "No pude liberar esa caja porque su cuenta ya no está disponible.",
    };
  }

  if (previous.current_balance > 0) {
    await moveBoxMoney(client, {
      userId: command.user_id,
      actor: command.actor,
      source: command.source,
      traceId: command.trace_id,
      amount: previous.current_balance,
      currency: account.currency === "USD" ? "USD" : "PEN",
      // Misma clave que usa la pantalla: liberar una caja concreta solo puede
      // registrarse una vez, aunque el boton se pulse dos veces.
      idempotencyKey: `box-delete-release:${previous.id}`,
      description: `Liberado desde caja ${previous.name}`,
      sourceRef: `box:${previous.id}:delete-release`,
      boxOriginId: previous.id,
      boxDestinationId: null,
      movementSource,
      metadata: {
        reason: "box_delete_release",
        box_id: previous.id,
        account_id: account.id,
        trace_id: command.trace_id,
      },
    });
  }

  await softDeleteBox(client, command.user_id, boxId);

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "box",
    entityId: boxId,
    action: "deleted",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: previous,
    newValue: { ...previous, deleted_at: new Date().toISOString() },
  });

  return {
    kind: "applied",
    entity: "caja",
    operation: "archive",
    entity_id: boxId,
    summary:
      previous.current_balance > 0
        ? `la caja ${previous.name}, y te devolví ${formatMoney(previous.current_balance)} a lo libre de ${account.name}`
        : `la caja ${previous.name}`,
    idempotent: false,
  };
}

/** Unico punto por el que la estructura le pide dinero al motor de saldos. */
async function moveBoxMoney(
  client: Client,
  input: {
    userId: string;
    actor: StructureCommand["actor"];
    source: string;
    traceId: string;
    amount: number;
    currency: "PEN" | "USD";
    idempotencyKey: string;
    description: string;
    sourceRef: string;
    boxOriginId: string | null;
    boxDestinationId: string | null;
    movementSource: MovementSource;
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const dispatcher = new CommandDispatcher(
    new SupabaseFinancialCoreRepository(client),
  );
  await dispatcher.dispatch({
    type: "CreateMovementCommand",
    command_id: randomUUID(),
    user_id: input.userId,
    actor: input.actor,
    source: input.source,
    trace_id: input.traceId,
    payload: {
      idempotency_key: input.idempotencyKey,
      movement: {
        type: "asignacion_interna",
        amount: input.amount,
        currency: input.currency,
        occurred_at: new Date().toISOString(),
        description: input.description,
        merchant: null,
        category_id: null,
        subcategory_id: null,
        account_origin_id: null,
        account_destination_id: null,
        box_origin_id: input.boxOriginId,
        box_destination_id: input.boxDestinationId,
        related_person_id: null,
        debt_id: null,
        recurring_rule_id: null,
        recurring_occurrence_id: null,
        source: input.movementSource,
        source_ref: input.sourceRef,
        confidence: 1,
        requires_review: false,
        metadata: input.metadata,
      },
    },
  });
}

// --- Meta -----------------------------------------------------------------

async function commitGoal(
  client: Client,
  command: Extract<
    StructureCommand,
    {
      type:
        | "CreateGoalCommand"
        | "UpdateGoalCommand"
        | "ArchiveGoalCommand"
        | "PauseGoalCommand"
        | "ResumeGoalCommand";
    }
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
      action: auditActionFor(operation),
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
    {
      type:
        | "CreateBudgetCommand"
        | "UpdateBudgetCommand"
        | "ArchiveBudgetCommand"
        | "PauseBudgetCommand"
        | "ResumeBudgetCommand";
    }
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
      action: auditActionFor(operation),
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

/**
 * `movement_audit_action_known` (`006`, ampliada en `046`) solo admite
 * `created`, `updated`, `corrected`, `deleted`, `reversed` y `restored`.
 * Archivar es un borrado logico; pausar y reanudar son cambios de estado.
 */
function auditActionFor(
  operation: StructureOperation,
): "created" | "updated" | "deleted" {
  if (operation === "create") return "created";
  if (operation === "archive") return "deleted";
  return "updated";
}

function splitGoalPayload(
  command: Extract<
    StructureCommand,
    {
      type:
        | "CreateGoalCommand"
        | "UpdateGoalCommand"
        | "ArchiveGoalCommand"
        | "PauseGoalCommand"
        | "ResumeGoalCommand";
    }
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
    {
      type:
        | "CreateBudgetCommand"
        | "UpdateBudgetCommand"
        | "ArchiveBudgetCommand"
        | "PauseBudgetCommand"
        | "ResumeBudgetCommand";
    }
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

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
