import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import type { RecurringRule, RecurringStatus } from "@/shared/types/domain";
import { getAccountById } from "@/data/repositories/accounts.repository";
import {
  cancelRecurringRule,
  createRecurringRule,
  getRecurringRuleById,
  updateRecurringRule,
} from "@/data/repositories/recurring.repository";
import {
  appendStructureAudit,
  findRecurringRuleByStructureIdempotencyKey,
} from "@/data/repositories/structure.repository";
import type { StructureCommand } from "./structure-commands";
import {
  formatMoney,
  type StructureExecutionResult,
} from "./structure-execution-result";

type Client = SupabaseClient<Database>;

/**
 * Ejecutor conversacional de pagos recurrentes (`RUL-REC-01`).
 *
 * **Por que este ejecutor y no otro.** Una regla recurrente no tiene RPC
 * transaccional: `059` solo creo `commit_recurring_occurrence_skip`, y
 * `commit_recurring_payment` existe para el momento en que la ocurrencia se
 * paga —eso si mueve dinero y por eso vive en el motor—. El alta, el cambio y
 * el cierre de la **regla** se escriben sobre `public.recurring_rules`, que ya
 * trae de `058` el contrato duro que hace falta: indice unico
 * `(user_id, creation_idempotency_key)`, `creation_request_hash` para detectar
 * la misma clave con otros datos, e indice unico de nombre por usuario mientras
 * la regla esta activa. Duplicar eso en un RPC nuevo seria una segunda fuente
 * de verdad sobre algo que la base ya sabe hacer.
 *
 * Tampoco entra en `CommandDispatcher`: una regla recurrente **no mueve
 * dinero**. Describe lo que se espera pagar; los saldos solo cambian cuando la
 * ocurrencia se marca pagada, y eso ya pasa por el motor.
 */

/** Estados en los que una regla ya esta cerrada y no admite mas cambios. */
const ESTADOS_CERRADOS: RecurringStatus[] = ["cancelled", "archived"];

export async function createRecurringFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "CreateRecurringCommand" }>,
): Promise<StructureExecutionResult> {
  const payload = command.payload;

  // Primer tramo de la idempotencia: si esta clave ya creo una regla, se
  // devuelve esa. El segundo tramo lo pone la base con su indice unico, que
  // `createRecurringRule` ya sabe absorber.
  const alreadyCreated = await findRecurringRuleByStructureIdempotencyKey(
    client,
    command.user_id,
    command.idempotency_key,
  );
  if (alreadyCreated) {
    return applied(alreadyCreated, "create", true);
  }

  if (payload.default_account_id) {
    const account = await getAccountForRule(
      client,
      command.user_id,
      payload.default_account_id,
      payload.currency,
    );
    if (account.kind === "failed") return account.result;
  }

  let rule: RecurringRule;
  try {
    rule = await createRecurringRule(client, {
      userId: command.user_id,
      name: payload.name,
      expectedAmount: payload.expected_amount,
      amountVariability: payload.amount_variability,
      currency: payload.currency,
      frequency: payload.frequency,
      nextExpectedDate: payload.next_expected_date,
      categoryId: payload.category_id,
      defaultAccountId: payload.default_account_id,
      idempotencyKey: command.idempotency_key,
      source: "conversational_structure",
      metadata: {
        created_from: "conversational_structure",
        trace_id: command.trace_id,
        command_id: command.command_id,
        note: "Un pago que viene no afecta saldos hasta que se marca pagado por el motor.",
      },
    });
  } catch (error) {
    const mapped = mapRecurringError(error, "create");
    if (mapped) return mapped;
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "recurring_rule",
    entityId: rule.id,
    action: "created",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: null,
    newValue: rule,
  });

  return applied(rule, "create", false);
}

export async function updateRecurringFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "UpdateRecurringCommand" }>,
): Promise<StructureExecutionResult> {
  const { recurring_rule_id: ruleId, ...changes } = command.payload;
  const previous = await getRecurringRuleById(client, command.user_id, ruleId);
  if (!previous) return notFound("update");

  if (ESTADOS_CERRADOS.includes(previous.status)) {
    return {
      kind: "failed",
      entity: "recurrente",
      operation: "update",
      reason: "conflict",
      error_code: "RECURRING_RULE_CLOSED",
      detail: "Ese pago recurrente ya estaba cerrado, así que no lo cambié.",
    };
  }

  const patch = {
    ...(changes.name !== undefined ? { name: changes.name } : {}),
    ...(changes.expected_amount !== undefined
      ? { expectedAmount: changes.expected_amount }
      : {}),
    ...(changes.amount_variability !== undefined
      ? { amountVariability: changes.amount_variability }
      : {}),
    ...(changes.frequency !== undefined
      ? { frequency: changes.frequency }
      : {}),
    ...(changes.next_expected_date !== undefined
      ? { nextExpectedDate: changes.next_expected_date }
      : {}),
    ...(changes.category_id !== undefined
      ? { categoryId: changes.category_id }
      : {}),
    ...(changes.default_account_id !== undefined
      ? { defaultAccountId: changes.default_account_id }
      : {}),
  };

  // Idempotencia por estado: si lo pedido ya es lo que hay, el segundo envio
  // no reescribe ni vuelve a anotar auditoria.
  if (isAlreadyApplied(previous, changes)) {
    return applied(previous, "update", true);
  }

  // `RUL-REC-04`: un pago fijo sin monto no es una expectativa. La base lo
  // rechaza; aqui se dice antes, con palabras.
  const resultingVariability =
    changes.amount_variability ?? previous.amount_variability;
  const resultingAmount =
    changes.expected_amount !== undefined
      ? changes.expected_amount
      : previous.expected_amount;
  if (resultingVariability === "fixed" && resultingAmount == null) {
    return {
      kind: "failed",
      entity: "recurrente",
      operation: "update",
      reason: "conflict",
      error_code: "RECURRING_RULE_FIXED_AMOUNT_REQUIRED",
      detail: "Un pago fijo necesita su monto. Dime de cuánto es.",
    };
  }

  if (changes.default_account_id) {
    const account = await getAccountForRule(
      client,
      command.user_id,
      changes.default_account_id,
      previous.currency,
      "update",
    );
    if (account.kind === "failed") return account.result;
  }

  let updated: RecurringRule;
  try {
    updated = await updateRecurringRule(
      client,
      command.user_id,
      ruleId,
      patch,
    );
  } catch (error) {
    const mapped = mapRecurringError(error, "update");
    if (mapped) return mapped;
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "recurring_rule",
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

  return applied(updated, "update", false);
}

/**
 * Pausar, reanudar y cancelar. Cancelar es la baja: `cancelRecurringRule` deja
 * `status = 'cancelled'` y sella `cancelled_at`, igual que
 * `POST /api/v1/recurring/[id]/cancel`.
 */
export async function changeRecurringStatusFromCommand(
  client: Client,
  command: Extract<
    StructureCommand,
    {
      type:
        | "PauseRecurringCommand"
        | "ResumeRecurringCommand"
        | "ArchiveRecurringCommand";
    }
  >,
): Promise<StructureExecutionResult> {
  const operation =
    command.type === "PauseRecurringCommand"
      ? ("pause" as const)
      : command.type === "ResumeRecurringCommand"
        ? ("resume" as const)
        : ("archive" as const);

  const ruleId = command.payload.recurring_rule_id;
  const previous = await getRecurringRuleById(client, command.user_id, ruleId);
  if (!previous) return notFound(operation);

  if (ESTADOS_CERRADOS.includes(previous.status)) {
    // Cancelar algo ya cancelado es el mismo destino: se responde como
    // idempotente en vez de como error, porque para el usuario ya esta hecho.
    if (operation === "archive") return applied(previous, operation, true);
    return {
      kind: "failed",
      entity: "recurrente",
      operation,
      reason: "conflict",
      error_code: "RECURRING_RULE_CLOSED",
      detail: "Ese pago recurrente ya estaba cerrado.",
    };
  }

  if (operation === "pause" && previous.status === "paused") {
    return applied(previous, operation, true);
  }
  if (operation === "resume" && previous.status === "active") {
    return applied(previous, operation, true);
  }
  if (operation === "resume" && previous.status !== "paused") {
    return {
      kind: "failed",
      entity: "recurrente",
      operation,
      reason: "conflict",
      error_code: "RECURRING_RULE_NOT_PAUSED",
      detail: "Ese pago recurrente no estaba pausado.",
    };
  }

  let updated: RecurringRule;
  try {
    updated =
      operation === "archive"
        ? await cancelRecurringRule(
            client,
            command.user_id,
            ruleId,
            command.trace_id,
          )
        : await updateRecurringRule(client, command.user_id, ruleId, {
            status: operation === "pause" ? "paused" : "active",
            metadata: {
              ...previous.metadata,
              [operation === "pause" ? "paused_from" : "resumed_from"]:
                "conversational_structure",
              trace_id: command.trace_id,
            } as Json,
          });
  } catch (error) {
    const mapped = mapRecurringError(error, operation);
    if (mapped) return mapped;
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "recurring_rule",
    entityId: updated.id,
    // Cancelar es una baja logica; pausar y reanudar son cambios de estado.
    action: operation === "archive" ? "deleted" : "updated",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: previous,
    newValue: updated,
  });

  return applied(updated, operation, false);
}

// --- Helpers ---------------------------------------------------------------

function applied(
  rule: RecurringRule,
  operation: "create" | "update" | "pause" | "resume" | "archive",
  idempotent: boolean,
): StructureExecutionResult {
  return {
    kind: "applied",
    entity: "recurrente",
    operation,
    entity_id: rule.id,
    summary: describeRule(rule),
    idempotent,
  };
}

function notFound(
  operation: "update" | "pause" | "resume" | "archive",
): StructureExecutionResult {
  return {
    kind: "failed",
    entity: "recurrente",
    operation,
    reason: "reference_not_found",
    error_code: "RECURRING_RULE_NOT_FOUND",
    detail: "No encontré ese pago recurrente.",
  };
}

/**
 * Comprueba que la cuenta sugerida es del usuario y que la moneda coincide,
 * la misma regla que aplica `POST /api/v1/recurring`. Una regla que apunta a
 * una cuenta en otra moneda propondria pagar en la divisa equivocada.
 */
async function getAccountForRule(
  client: Client,
  userId: string,
  accountId: string,
  currency: string,
  operation: "create" | "update" = "create",
): Promise<{ kind: "ok" } | { kind: "failed"; result: StructureExecutionResult }> {
  const account = await getAccountById(client, userId, accountId);
  if (!account) {
    return {
      kind: "failed",
      result: {
        kind: "failed",
        entity: "recurrente",
        operation,
        reason: "reference_not_found",
        error_code: "ACCOUNT_NOT_FOUND",
        detail: "No encontré esa cuenta.",
      },
    };
  }
  if (account.currency !== currency) {
    return {
      kind: "failed",
      result: {
        kind: "failed",
        entity: "recurrente",
        operation,
        reason: "conflict",
        error_code: "RECURRING_RULE_CURRENCY_MISMATCH",
        detail: `${account.name} está en ${account.currency} y ese pago es en ${currency}.`,
      },
    };
  }
  return { kind: "ok" };
}

function isAlreadyApplied(
  previous: RecurringRule,
  changes: Record<string, unknown>,
): boolean {
  const equivalencias: Record<string, unknown> = {
    name: previous.name,
    expected_amount: previous.expected_amount,
    amount_variability: previous.amount_variability,
    frequency: previous.frequency,
    next_expected_date: previous.next_expected_date,
    category_id: previous.category_id,
    default_account_id: previous.default_account_id,
  };

  const pedidos = Object.keys(changes).filter(
    (field) => changes[field] !== undefined,
  );
  if (pedidos.length === 0) return true;
  return pedidos.every((field) => equivalencias[field] === changes[field]);
}

/**
 * Traduce los errores que `recurring.repository` levanta como `Error` con
 * mensaje conocido. Devuelve `null` cuando el error no es uno de ellos, para
 * que el despachador lo trate como fallo del nucleo.
 */
function mapRecurringError(
  error: unknown,
  operation: "create" | "update" | "pause" | "resume" | "archive",
): StructureExecutionResult | null {
  if (!(error instanceof Error)) return null;

  if (error.message.includes("RECURRING_RULE_NAME_CONFLICT")) {
    return {
      kind: "failed",
      entity: "recurrente",
      operation,
      reason: "conflict",
      error_code: "RECURRING_RULE_NAME_CONFLICT",
      detail: "Ya tienes un pago que viene con ese nombre.",
    };
  }

  if (error.message.includes("RECURRING_RULE_IDEMPOTENCY_CONFLICT")) {
    return {
      kind: "failed",
      entity: "recurrente",
      operation,
      reason: "conflict",
      error_code: "RECURRING_RULE_IDEMPOTENCY_CONFLICT",
      detail: null,
    };
  }

  if (error.message.includes("RECURRING_RULE_NEXT_DATE_IN_PAST")) {
    return {
      kind: "failed",
      entity: "recurrente",
      operation,
      reason: "conflict",
      error_code: "RECURRING_RULE_NEXT_DATE_IN_PAST",
      detail: "La próxima fecha no puede ser anterior a hoy.",
    };
  }

  return null;
}

function describeRule(rule: RecurringRule): string {
  const monto =
    rule.expected_amount == null
      ? "de monto variable"
      : `de ${formatMoney(rule.expected_amount)}`;
  return `el pago ${rule.name} ${monto}`;
}
