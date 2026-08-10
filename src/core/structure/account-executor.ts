import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { Account } from "@/shared/types/domain";
import {
  archiveBoxesForAccount,
  createAccount,
  getAccountById,
  getActiveAccounts,
  softDeleteAccount,
  updateAccountMeta,
} from "@/data/repositories/accounts.repository";
import {
  appendStructureAudit,
  BOX_STRUCTURE_IDEMPOTENCY_METADATA_KEY,
  findAccountByStructureIdempotencyKey,
  isUniqueViolation,
} from "@/data/repositories/structure.repository";
import type { StructureCommand } from "./structure-commands";
import {
  formatMoney,
  type StructureExecutionResult,
} from "./structure-execution-result";

type Client = SupabaseClient<Database>;

/**
 * Ejecutor conversacional de cuentas (`RUL-CUENTAS-01`).
 *
 * **Por que este ejecutor y no otro.** Una cuenta no tiene RPC transaccional
 * ni almacen de recibos: se escribe sobre `public.accounts`, exactamente como
 * hacen `POST /api/v1/accounts` y `DELETE /api/v1/accounts/[id]`. Es el mismo
 * caso que las cajas, y por eso sigue su patron: escritura directa sobre la
 * tabla, idempotencia sellada en `metadata->>'structure_idempotency_key'` con
 * el indice de la migracion `074`, y auditoria en `movement_audit_log`.
 *
 * Tampoco entra en `CommandDispatcher`. El saldo inicial de una cuenta no es un
 * movimiento: es una **declaracion** del usuario sobre cuanto habia ahi cuando
 * empezo, y por eso va a `initial_balance`/`current_balance` sin generar
 * historia, igual que en la pantalla. El motor de saldos solo registra dinero
 * que se movio de verdad.
 */

export async function createAccountFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "CreateAccountCommand" }>,
): Promise<StructureExecutionResult> {
  const payload = command.payload;

  const alreadyCreated = await findAccountByStructureIdempotencyKey(
    client,
    command.user_id,
    command.idempotency_key,
  );
  if (alreadyCreated) {
    return applied(alreadyCreated, "create", true);
  }

  // `RUL-CUENTAS-13`: la primera cuenta activa es la de por defecto. No se
  // cambia la cuenta por defecto conversando —esa decision tiene su propia
  // pantalla— asi que solo se marca cuando no habia ninguna.
  const existentes = await getActiveAccounts(client, command.user_id);
  const esLaPrimera = existentes.length === 0;

  let account: Account;
  try {
    account = await createAccount(client, {
      userId: command.user_id,
      name: payload.name,
      type: payload.type,
      institution: payload.institution ?? undefined,
      currency: payload.currency,
      initialBalance: payload.initial_balance,
      isDefault: esLaPrimera,
      metadata: {
        created_from: "conversational_structure",
        [BOX_STRUCTURE_IDEMPOTENCY_METADATA_KEY]: command.idempotency_key,
        trace_id: command.trace_id,
        command_id: command.command_id,
        initial_balance_source: "user_declared",
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        kind: "failed",
        entity: "cuenta",
        operation: "create",
        reason: "conflict",
        error_code: "ACCOUNT_NAME_TAKEN",
        detail: `Ya tienes una cuenta activa que se llama "${payload.name}".`,
      };
    }
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "account",
    entityId: account.id,
    action: "created",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: null,
    newValue: account,
  });

  return applied(account, "create", false);
}

export async function updateAccountFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "UpdateAccountCommand" }>,
): Promise<StructureExecutionResult> {
  const { account_id: accountId, ...changes } = command.payload;
  const previous = await getAccountById(client, command.user_id, accountId);
  if (!previous) return notFound("update");

  const alreadyApplied = (
    Object.keys(changes) as Array<keyof typeof changes>
  ).every((field) => previous[field] === changes[field]);
  if (alreadyApplied) {
    return applied(previous, "update", true);
  }

  let updated: Account;
  try {
    updated = await updateAccountMeta(
      client,
      command.user_id,
      accountId,
      changes,
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        kind: "failed",
        entity: "cuenta",
        operation: "update",
        reason: "conflict",
        error_code: "ACCOUNT_NAME_TAKEN",
        detail: "Ya tienes otra cuenta activa con ese nombre.",
      };
    }
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "account",
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
 * Archiva la cuenta con la misma semantica que `DELETE /api/v1/accounts/[id]`
 * (`24` §5.1): archivar no es borrar. Las cajas de la cuenta se archivan en
 * cascada, los movimientos se conservan y el saldo se queda contabilizado en la
 * cuenta archivada, que deja de sumar al total.
 *
 * No se libera el dinero de las cajas: a diferencia de archivar una caja
 * suelta, aqui la cuenta entera sale de la vista, asi que mover ese saldo a
 * "libre" seria mover dinero a un sitio que el usuario ya no mira.
 */
export async function archiveAccountFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "ArchiveAccountCommand" }>,
): Promise<StructureExecutionResult> {
  const accountId = command.payload.account_id;
  const previous = await getAccountById(client, command.user_id, accountId);

  // `getAccountById` filtra por `deleted_at is null`: si ya no aparece, o no
  // es del usuario o ya estaba archivada. Las dos cosas se responden igual
  // desde fuera (`SEG-04`: 404, nunca 403), y para el usuario dueño el
  // segundo caso es "ya estaba hecho".
  if (!previous) return notFound("archive");

  const archivedBoxes = await archiveBoxesForAccount(
    client,
    command.user_id,
    accountId,
  );
  await softDeleteAccount(client, command.user_id, accountId);

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "account",
    entityId: accountId,
    action: "deleted",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: previous,
    newValue: {
      ...previous,
      deleted_at: new Date().toISOString(),
      archived_box_count: archivedBoxes.length,
    },
  });

  return {
    kind: "applied",
    entity: "cuenta",
    operation: "archive",
    entity_id: accountId,
    summary:
      archivedBoxes.length > 0
        ? `la cuenta ${previous.name} y sus ${archivedBoxes.length} caja${archivedBoxes.length === 1 ? "" : "s"}`
        : `la cuenta ${previous.name}`,
    idempotent: false,
  };
}

// --- Helpers ---------------------------------------------------------------

function applied(
  account: Account,
  operation: "create" | "update",
  idempotent: boolean,
): StructureExecutionResult {
  return {
    kind: "applied",
    entity: "cuenta",
    operation,
    entity_id: account.id,
    summary: describeAccount(account),
    idempotent,
  };
}

function notFound(
  operation: "update" | "archive",
): StructureExecutionResult {
  return {
    kind: "failed",
    entity: "cuenta",
    operation,
    reason: "reference_not_found",
    error_code: "ACCOUNT_NOT_FOUND",
    detail: "No encontré esa cuenta.",
  };
}

function describeAccount(account: Account): string {
  return account.current_balance !== 0
    ? `la cuenta ${account.name} con ${formatMoney(account.current_balance)}`
    : `la cuenta ${account.name}`;
}
