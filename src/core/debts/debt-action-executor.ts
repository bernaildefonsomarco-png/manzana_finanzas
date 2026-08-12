import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { ClassificationCommandDispatcher } from "@/core/classification";
import {
  assertSystemActionAllowed,
  SystemActionRiskDeniedError,
} from "@/core/risk/system-action-gate";
import {
  closeDebt,
  DebtOperationError,
  getDebtById,
  getDebtInstallmentById,
  reopenDebt,
  rescheduleDebtInstallment,
  skipDebtInstallment,
} from "@/data/repositories/debts.repository";
import { getClassificationCatalog } from "@/data/repositories/classification.repository";
import {
  appendStructureAudit,
  isUniqueViolation,
} from "@/data/repositories/structure.repository";
import { logger } from "@/shared/telemetry/logger";
import { formatDebtMoney } from "./debt-action-consequences";
import type { DebtActionExecutionResult } from "./debt-action-execution-result";
import type { DebtActionCommand } from "./debt-action-proposal";

type Client = SupabaseClient<Database>;

/**
 * Ejecuta una operacion de deuda ya confirmada por el usuario (`RUL-DEUDAS-13`).
 *
 * Es el hermano de `CommandDispatcher` y de `executeStructureCommand` para el
 * ciclo de vida de una deuda, **no** una extension de ninguno de los dos, y por
 * la misma regla que ya escribio `structure-commands.ts`: el despachador
 * financiero es el motor de movimientos y saldos —sus payloads son
 * `MovementInput`, su idempotencia es `movements.idempotency_key`— y ninguna de
 * estas cinco operaciones crea un movimiento.
 *
 * El precedente que decide donde va cada una esta dentro del propio despachador:
 * los pagos y las altas de deuda **se delegan** a `DebtPaymentCommandHandler` y
 * `DebtCreationCommandHandler` en lugar de absorberse, porque los dos si mueven
 * dinero. Cerrar, reabrir, mover una cuota y saltar una cuota **no lo mueven**:
 * cambian el estado de la deuda con un RPC atomico que ya existe
 * (`commit_debt_operation`, `057`) y que trae su propia idempotencia con recibo
 * (`debt_operation_receipts`). Meterlas en el despachador crearia una segunda
 * fuente de verdad sobre algo que la base ya sabe hacer de forma atomica.
 *
 * `crear_persona` se va todavia mas lejos: no es de deudas, es de clasificacion,
 * y ya tiene despachador propio (`ClassificationCommandDispatcher`). Aqui solo
 * se le llama.
 *
 * Nunca se invoca sin confirmacion explicita: quien llama ya resolvio el boton
 * `deuda:<uuid>` o el "si" equivalente del mismo hilo.
 */
export async function executeDebtActionCommand(params: {
  client: Client;
  userId: string;
  command: DebtActionCommand;
  source: string;
  traceId: string;
}): Promise<DebtActionExecutionResult> {
  const { command } = params;

  try {
    // La confirmacion ya ocurrio antes de llegar aqui; el gate deja constancia
    // del tipo de accion y de que fue explicita.
    assertSystemActionAllowed({
      actionKind:
        command.operation === "create_person"
          ? "experience_feedback"
          : "financial_write",
      // Cerrar es lo unico de riesgo alto: escribe en el historial que un dinero
      // se pagó o que no se pagó nunca. Lo demas mueve fechas o estados.
      baseRiskLevel: command.operation === "close" ? "high" : "medium",
      explicitUserConfirmation: true,
      authenticatedSession: true,
      // Ninguna de las cinco es irreversible: un cierre condonado se reabre, una
      // cuota movida se vuelve a mover, una persona se archiva. Declararlas
      // irreversibles pediria una segunda confirmacion que el usuario ya dio.
      reversible: true,
    });

    if (command.operation === "create_person") {
      return await executeCreatePerson({ ...params, command });
    }
    return await executeDebtOperation({ ...params, command });
  } catch (error) {
    if (error instanceof SystemActionRiskDeniedError) {
      return failure(command, "risk_policy", "DEBT_ACTION_RISK_DENIED", null);
    }
    if (error instanceof DebtOperationError) {
      return failure(
        command,
        error.code === "DEBT_OPERATION_NOT_FOUND"
          ? "reference_not_found"
          : error.code === "DEBT_OPERATION_CONFLICT"
            ? "conflict"
            : "invalid_command",
        error.code,
        error.message,
      );
    }
    logger.error("debt_action.execution_failed", {
      trace_id: params.traceId,
      operation: command.operation,
      catalog_command: command.catalog_command,
      error,
    });
    return failure(command, "core_error", "DEBT_ACTION_CORE_ERROR", null);
  }
}

type DebtOperationCommand = Exclude<
  DebtActionCommand,
  { operation: "create_person" }
>;

async function executeDebtOperation(params: {
  client: Client;
  userId: string;
  command: DebtOperationCommand;
  source: string;
  traceId: string;
}): Promise<DebtActionExecutionResult> {
  const { client, userId, command } = params;

  // El estado real manda sobre el borrador. Entre la propuesta y el "si" pueden
  // haber pasado quince minutos y un pago desde la pantalla, y ejecutar contra
  // la foto vieja es exactamente lo que `RUL-DEUDAS-13` prohibe.
  const debt = await getDebtById(client, userId, command.payload.debt_id);
  if (!debt) {
    return failure(
      command,
      "reference_not_found",
      "DEBT_ACTION_DEBT_NOT_FOUND",
      "No encontré esa deuda.",
    );
  }

  const before = {
    status: debt.status,
    current_balance: debt.current_balance,
  };

  if (command.operation === "close") {
    // `RUL-DEUDAS-13`: el saldo cambio despues de proponerlo. No se ejecuta con
    // la etiqueta que se decidio sobre otra cifra — se dice y se vuelve a pedir.
    if (round(debt.current_balance) !== round(command.payload.balance_at_proposal)) {
      return failure(
        command,
        "conflict",
        "DEBT_ACTION_BALANCE_CHANGED",
        `El saldo de «${debt.name}» cambió desde que te lo propuse: ahora son ${formatDebtMoney(round(debt.current_balance), debt.currency)}. Vuélvemelo a pedir y te muestro las opciones con la cifra correcta.`,
      );
    }

    const result = await closeDebt(client, {
      userId,
      debt,
      reason: command.payload.reason,
      idempotencyKey: command.idempotency_key,
      traceId: params.traceId,
    });
    await audit({
      ...params,
      entityType: "debt",
      entityId: debt.id,
      action: "updated",
      oldValue: before,
      newValue: { status: result.debt.status, reason: command.payload.reason },
    });
    return {
      kind: "applied",
      operation: "close",
      catalog_command: command.catalog_command,
      entity_id: debt.id,
      summary:
        command.payload.reason === "paid"
          ? `«${debt.name}», cerrada como pagada`
          : `«${debt.name}», dada por perdonada con ${formatDebtMoney(command.payload.balance_at_proposal, debt.currency)} sin pagar`,
      idempotent: result.idempotent,
    };
  }

  if (command.operation === "reopen") {
    const result = await reopenDebt(client, {
      userId,
      debt,
      idempotencyKey: command.idempotency_key,
      traceId: params.traceId,
    });
    await audit({
      ...params,
      entityType: "debt",
      entityId: debt.id,
      action: "updated",
      oldValue: before,
      newValue: {
        status: result.debt.status,
        current_balance: result.debt.current_balance,
      },
    });
    return {
      kind: "applied",
      operation: "reopen",
      catalog_command: command.catalog_command,
      entity_id: debt.id,
      summary: `«${debt.name}», reabierta con ${formatDebtMoney(round(result.debt.current_balance), debt.currency)} de saldo`,
      idempotent: result.idempotent,
    };
  }

  const installment = await getDebtInstallmentById(
    client,
    userId,
    debt.id,
    command.payload.installment_id,
  );
  if (!installment) {
    return failure(
      command,
      "reference_not_found",
      "DEBT_ACTION_INSTALLMENT_NOT_FOUND",
      "No encontré esa cuota dentro de la deuda.",
    );
  }

  if (command.operation === "reschedule_installment") {
    const result = await rescheduleDebtInstallment(client, {
      userId,
      installment,
      dueDate: command.payload.due_date,
      reason: command.payload.reason,
      idempotencyKey: command.idempotency_key,
      traceId: params.traceId,
    });
    await audit({
      ...params,
      entityType: "debt_installment",
      entityId: installment.id,
      action: "updated",
      oldValue: { due_date: installment.due_date },
      newValue: { due_date: result.installment.due_date },
    });
    return {
      kind: "applied",
      operation: "reschedule_installment",
      catalog_command: command.catalog_command,
      entity_id: installment.id,
      summary: `la cuota ${installment.number} de «${debt.name}», movida al ${command.payload.due_date}`,
      idempotent: result.idempotent,
    };
  }

  const result = await skipDebtInstallment(client, {
    userId,
    installment,
    reason: command.payload.reason,
    idempotencyKey: command.idempotency_key,
    traceId: params.traceId,
  });
  await audit({
    ...params,
    entityType: "debt_installment",
    entityId: installment.id,
    action: "updated",
    oldValue: { status: installment.status },
    newValue: {
      status: result.installment.status,
      reason: command.payload.reason,
    },
  });
  return {
    kind: "applied",
    operation: "skip_installment",
    catalog_command: command.catalog_command,
    entity_id: installment.id,
    summary: `la cuota ${installment.number} de «${debt.name}», marcada como omitida`,
    idempotent: result.idempotent,
  };
}

/**
 * `RUL-DEUDAS-15` / `ERR-DEUDAS-08`: dar de alta a una persona relacionada.
 *
 * No hay recibo de idempotencia como en `commit_debt_operation`, pero si un
 * indice unico por `(user_id, normalized_name)` desde `013`. Un doble envio del
 * mismo boton choca contra el, y ese choque **no es un fallo**: es la prueba de
 * que la persona ya esta. Se busca y se devuelve como `idempotent`, en vez de
 * contarle al usuario un error por algo que quedo bien.
 */
async function executeCreatePerson(params: {
  client: Client;
  userId: string;
  command: Extract<DebtActionCommand, { operation: "create_person" }>;
  source: string;
  traceId: string;
}): Promise<DebtActionExecutionResult> {
  const { client, userId, command } = params;
  const commandId = randomUUID();

  try {
    const dispatched = await new ClassificationCommandDispatcher(client).dispatch({
      type: "CreateRelatedPersonCommand",
      command_id: commandId,
      user_id: userId,
      actor: { type: "user", id: userId },
      source: params.source,
      trace_id: params.traceId,
      payload: {
        display_name: command.payload.display_name,
        kind: command.payload.kind,
        relationship_label: command.payload.relationship_label,
        confirmed_by_user: true,
      },
    });

    // El despachador devuelve la entidad de clasificacion sin discriminar; para
    // `CreateRelatedPersonCommand` es siempre una `RelatedPerson`.
    const created = dispatched.entity as { id: string };

    await audit({
      ...params,
      commandId,
      entityType: "related_person",
      entityId: created.id,
      action: "created",
      oldValue: null,
      newValue: { display_name: command.payload.display_name },
    });

    return {
      kind: "applied",
      operation: "create_person",
      catalog_command: command.catalog_command,
      entity_id: created.id,
      summary: command.payload.display_name,
      idempotent: false,
    };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const existing = await findPersonByName(
      client,
      userId,
      command.payload.display_name,
    );
    if (!existing) {
      return failure(
        command,
        "conflict",
        "DEBT_ACTION_PERSON_CONFLICT",
        "Ya tienes a alguien con ese nombre.",
      );
    }
    return {
      kind: "applied",
      operation: "create_person",
      catalog_command: command.catalog_command,
      entity_id: existing.id,
      summary: existing.display_name,
      idempotent: true,
    };
  }
}

async function findPersonByName(
  client: Client,
  userId: string,
  displayName: string,
): Promise<{ id: string; display_name: string } | null> {
  const catalog = await getClassificationCatalog(client, userId);
  const objetivo = normalizar(displayName);
  return (
    catalog.related_people.find(
      (persona) => normalizar(persona.display_name) === objetivo,
    ) ?? null
  );
}

/**
 * `AC-CATALOGO-10` / `40` §3: toda escritura conversacional deja rastro. El
 * `entity_type` de `movement_audit_log` es texto libre y `action` admite
 * `created`/`updated` (`006`, ampliada en `046`), asi que `debt`,
 * `debt_installment` y `related_person` entran sin tocar el esquema.
 *
 * La auditoria **no** puede tumbar una escritura que ya ocurrio: si falla, se
 * registra y se sigue. Perder la linea de auditoria es malo; deshacer un cierre
 * que la base ya confirmo, peor.
 */
async function audit(params: {
  client: Client;
  userId: string;
  command: DebtActionCommand;
  source: string;
  traceId: string;
  commandId?: string;
  entityType: string;
  entityId: string;
  action: "created" | "updated";
  oldValue: unknown;
  newValue: unknown;
}): Promise<void> {
  try {
    await appendStructureAudit(params.client, {
      userId: params.userId,
      entityType: params.entityType as Parameters<
        typeof appendStructureAudit
      >[1]["entityType"],
      entityId: params.entityId,
      action: params.action,
      actorType: "user",
      actorId: params.userId,
      source: params.source,
      traceId: params.traceId,
      commandId: params.commandId ?? randomUUID(),
      idempotencyKey: params.command.idempotency_key,
      oldValue: params.oldValue,
      newValue: params.newValue,
    });
  } catch (error) {
    logger.error("debt_action.audit_append_failed", {
      trace_id: params.traceId,
      catalog_command: params.command.catalog_command,
      error,
    });
  }
}

function failure(
  command: DebtActionCommand,
  reason: Extract<DebtActionExecutionResult, { kind: "failed" }>["reason"],
  errorCode: string,
  detail: string | null,
): DebtActionExecutionResult {
  return {
    kind: "failed",
    operation: command.operation,
    catalog_command: command.catalog_command,
    reason,
    error_code: errorCode,
    detail,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
