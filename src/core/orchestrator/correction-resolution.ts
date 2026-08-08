import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  buildAccountCorrectionPatch,
  buildAmountCorrectionPatch,
  buildCategoryCorrectionPatch,
  buildLoanCorrectionPatch,
  restorePersonNameFromSlug,
} from "@/agents/correction-agent";
import { CommandDispatcher } from "@/core/finance";
import type { MovementPatch } from "@/core/finance/commands";
import { CoreError } from "@/core/finance/errors";
import {
  assertSystemActionAllowed,
  SystemActionRiskDeniedError,
} from "@/core/risk/system-action-gate";
import { getAccountById } from "@/data/repositories/accounts.repository";
import { getCategoryById } from "@/data/repositories/categories.repository";
import {
  SupabaseFinancialCoreRepository,
  type RecentMovementForCorrection,
} from "@/data/repositories/movements.repository";
import {
  isConfirmationText,
  isDiscardText,
} from "./pending-resolution-from-text";
import type { Database } from "@/data/supabase/types";
import {
  CATEGORY_IDS,
  type CategoryId,
  type Movement,
  type MovementType,
} from "@/shared/types/domain";

type Client = SupabaseClient<Database>;
type AccountField = "account_origin_id" | "account_destination_id";

export const CORRECTION_CANCEL_COMMAND_ID = "corr:cancel";

export type ParsedCorrectionCommand =
  | {
      kind: "cancel";
      command_id: typeof CORRECTION_CANCEL_COMMAND_ID;
    }
  | {
      kind: "loan_to" | "loan_from";
      command_id: string;
      movement_id: string;
      target_type: Extract<MovementType, "prestamo_dado" | "prestamo_recibido">;
      related_person_name: string;
    }
  | {
      kind: "amount";
      command_id: string;
      movement_id: string;
      amount: number;
    }
  | {
      kind: "category";
      command_id: string;
      movement_id: string;
      category_id: CategoryId;
    }
  | {
      kind: "account_origin" | "account_destination";
      command_id: string;
      movement_id: string;
      account_id: string;
      account_field: AccountField;
    }
  | {
      kind: "delete";
      command_id: string;
      movement_id: string;
      delete_mode: "soft_delete";
    };

type ExecutableCorrectionCommand = Exclude<
  ParsedCorrectionCommand,
  { kind: "cancel" }
>;

export type CorrectionResolutionResult =
  | {
      kind: "not_correction_command";
      reason: "no_correction_command";
      command: null;
      movement: null;
      idempotent: false;
    }
  | {
      kind: "cancelled";
      reason: "user_cancelled_correction";
      command: ParsedCorrectionCommand;
      movement: null;
      idempotent: false;
    }
  | {
      kind: "applied";
      reason: "correction_applied" | "already_applied";
      command: ExecutableCorrectionCommand;
      movement: Movement;
      idempotent: boolean;
      summary: string;
    }
  | {
      kind: "failed";
      reason:
        | "unsupported_command"
        | "movement_not_found"
        | "movement_inactive"
        | "reference_not_found"
        | "risk_policy"
        | "core_error"
        // `23` §5b.1 / `AC-RT-13`: la propuesta caduco antes de que llegara la
        // confirmacion. No se ejecuta y se le dice al usuario.
        | "proposal_lapsed";
      command: ParsedCorrectionCommand | null;
      movement: null;
      idempotent: false;
      error_code: string | null;
    };

export function isCorrectionCommandText(value: string): boolean {
  return value.trim().startsWith("corr:");
}

export function parseCorrectionCommandText(
  value: string
): ParsedCorrectionCommand | null {
  const text = value.trim();
  if (text === CORRECTION_CANCEL_COMMAND_ID) {
    return {
      kind: "cancel",
      command_id: CORRECTION_CANCEL_COMMAND_ID,
    };
  }

  const [prefix, action, movementId, payload] = text.split(":");
  if (prefix !== "corr" || !action || !movementId) {
    return null;
  }

  if (!isUuid(movementId)) return null;

  if (action === "delete") {
    return {
      kind: "delete",
      command_id: text,
      movement_id: movementId,
      delete_mode: "soft_delete",
    };
  }

  if (!payload) return null;

  if (action === "loan_to") {
    return {
      kind: "loan_to",
      command_id: text,
      movement_id: movementId,
      target_type: "prestamo_dado",
      related_person_name: restorePersonNameFromSlug(payload),
    };
  }

  if (action === "loan_from") {
    return {
      kind: "loan_from",
      command_id: text,
      movement_id: movementId,
      target_type: "prestamo_recibido",
      related_person_name: restorePersonNameFromSlug(payload),
    };
  }

  if (action === "amount") {
    const amount = decodeAmountToken(payload);
    if (!amount) return null;
    return {
      kind: "amount",
      command_id: text,
      movement_id: movementId,
      amount,
    };
  }

  if (action === "category" && isCategoryId(payload)) {
    return {
      kind: "category",
      command_id: text,
      movement_id: movementId,
      category_id: payload,
    };
  }

  if (action === "acct_origin" && isUuid(payload)) {
    return {
      kind: "account_origin",
      command_id: text,
      movement_id: movementId,
      account_id: payload,
      account_field: "account_origin_id",
    };
  }

  if (action === "acct_destination" && isUuid(payload)) {
    return {
      kind: "account_destination",
      command_id: text,
      movement_id: movementId,
      account_id: payload,
      account_field: "account_destination_id",
    };
  }

  return null;
}

/**
 * `23` §5b.1: una propuesta sin confirmar vale 15 minutos, o hasta que el
 * usuario cambia de tema. Pasado eso, confirmarla seria ejecutar algo que el
 * usuario ya no tiene presente, que es justo lo que el principio de control
 * evita.
 */
export const CORRECTION_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

export type AwaitingCorrectionResolution =
  /** No hay ninguna correccion esperando confirmacion. */
  | { kind: "none" }
  /** Confirmacion o descarte validos: mismo hilo, dentro de la vigencia. */
  | {
      kind: "confirmable";
      commandText: string;
      commandIds: string[];
    }
  /**
   * El usuario confirmo (o descarto) pero la propuesta ya no vale. No se
   * ejecuta y **se dice** (`AC-RT-13`): nunca se ejecuta ni se descarta en
   * silencio.
   */
  | {
      kind: "lapsed_confirmation";
      reason: "confirmation_window_expired" | "thread_unknown";
      commandIds: string[];
    }
  /**
   * Hay una propuesta viva pero pertenece a otra conversacion. Este turno la
   * ignora por completo: ni la ejecuta ni la toca, porque caducarla aqui seria
   * decidir por el hilo que si la esta esperando.
   */
  | { kind: "other_thread"; commandIds: string[] }
  /**
   * Turno que no es ni confirmacion ni descarte con una propuesta viva de este
   * hilo: `23` §5b.1 la caduca por cambio de tema.
   */
  | { kind: "lapsed_by_topic_change"; commandIds: string[] };

/**
 * `16` §10.3: cuando Manzana propone borrar o cambiar un movimiento, el
 * usuario confirma con el boton (`corr:...`) o escribiendo ("si, eliminalo").
 * Una propuesta de correccion no crea un pending item, asi que ese "si" no
 * tiene nada que resolver en `pending-resolution-from-text` ni en el borrador
 * de captura: sin este puente el turno caia en el respaldo de captura
 * ("No encontre algo reciente para registrar...") y la eliminacion confirmada
 * nunca se ejecutaba.
 *
 * Solo puentea cuando la ultima accion recordada es exactamente una correccion
 * propuesta esperando confirmacion: con varios candidatos abiertos el "si" es
 * ambiguo y `16` §10.3 prohibe resolver varios elementos con un "ok" ambiguo.
 *
 * Ademas exige que la propuesta siga siendo suya y siga viva (`23` §5b.1):
 *
 *  - **mismo hilo**: el estado conversacional era global por usuario, asi que
 *    una propuesta de otra conversacion podia ejecutarse con un "si" que
 *    hablaba de otra cosa. Sin sello de hilo —estados escritos antes de este
 *    arreglo, o base sin la migracion `069`— la propuesta **no** es
 *    confirmable: el lado seguro es preguntar de mas;
 *  - **dentro de la vigencia**: 15 minutos desde que se propuso;
 *  - **adyacencia**: cualquier turno intermedio que no sea confirmacion ni
 *    descarte la caduca (`lapsed_by_topic_change`), de modo que un "si"
 *    posterior ya no encuentra nada armado.
 */
export function resolveAwaitingCorrection(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  /** Hilo del turno actual (`resolveTurnThreadKey`). */
  threadKey: string;
  /** Instante del turno, en ISO. */
  now: string;
}): AwaitingCorrectionResolution {
  const lastAction = params.workingSet?.last_action ?? null;
  if (
    !lastAction ||
    lastAction.kind !== "correction_proposed" ||
    lastAction.status !== "awaiting_confirmation" ||
    lastAction.command_ids.length === 0
  ) {
    return { kind: "none" };
  }

  const commandIds = [...lastAction.command_ids];
  const storedThreadKey = lastAction.thread_key ?? null;
  const answersTheProposal =
    isConfirmationText(params.text) || isDiscardText(params.text);

  // Otra conversacion: este turno no la ejecuta ni la caduca.
  if (storedThreadKey && storedThreadKey !== params.threadKey) {
    return { kind: "other_thread", commandIds };
  }

  if (!answersTheProposal) {
    return { kind: "lapsed_by_topic_change", commandIds };
  }

  if (!storedThreadKey) {
    return {
      kind: "lapsed_confirmation",
      reason: "thread_unknown",
      commandIds,
    };
  }

  if (isConfirmationWindowExpired(lastAction.confirmation_expires_at, params.now)) {
    return {
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
      commandIds,
    };
  }

  // Con varios candidatos abiertos el "si" no elige ninguno (`16` §10.3): la
  // propuesta queda caducada por este turno, no ejecutada a medias.
  if (commandIds.length !== 1) {
    return { kind: "lapsed_by_topic_change", commandIds };
  }

  const command = parseCorrectionCommandText(commandIds[0]);
  if (!command || command.kind === "cancel") {
    return { kind: "lapsed_by_topic_change", commandIds };
  }

  if (isDiscardText(params.text)) {
    return {
      kind: "confirmable",
      commandText: CORRECTION_CANCEL_COMMAND_ID,
      commandIds,
    };
  }

  return { kind: "confirmable", commandText: command.command_id, commandIds };
}

/**
 * Puente de compatibilidad: devuelve el texto de comando equivalente al boton
 * que el usuario habria pulsado, o `null` si no hay una correccion inequivoca,
 * viva y de este mismo hilo que resolver.
 */
export function resolveAwaitingCorrectionCommandText(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  threadKey: string;
  now: string;
}): string | null {
  const resolution = resolveAwaitingCorrection(params);
  return resolution.kind === "confirmable" ? resolution.commandText : null;
}

/**
 * Sin sello de vigencia (estados anteriores a este arreglo) la propuesta se
 * considera vencida: el lado seguro.
 */
function isConfirmationWindowExpired(
  confirmationExpiresAt: string | null | undefined,
  now: string
): boolean {
  if (!confirmationExpiresAt) return true;
  const expiresAt = Date.parse(confirmationExpiresAt);
  const current = Date.parse(now);
  if (Number.isNaN(expiresAt) || Number.isNaN(current)) return true;
  return current >= expiresAt;
}

/**
 * Resultado de una confirmacion que llego tarde o sin sello de hilo: nada se
 * ejecuta, y el planificador lo comunica (`AC-RT-13`).
 */
export function lapsedCorrectionResolution(
  reason: "confirmation_window_expired" | "thread_unknown"
): Extract<CorrectionResolutionResult, { kind: "failed" }> {
  return {
    kind: "failed",
    reason: "proposal_lapsed",
    command: null,
    movement: null,
    idempotent: false,
    error_code:
      reason === "thread_unknown"
        ? "CORRECTION_PROPOSAL_THREAD_UNKNOWN"
        : "CORRECTION_PROPOSAL_EXPIRED",
  };
}

export async function maybeResolveCorrection(params: {
  client: Client;
  userId: string;
  text: string;
  traceId: string;
}): Promise<CorrectionResolutionResult> {
  if (!isCorrectionCommandText(params.text)) {
    return {
      kind: "not_correction_command",
      reason: "no_correction_command",
      command: null,
      movement: null,
      idempotent: false,
    };
  }

  const command = parseCorrectionCommandText(params.text);
  if (!command) {
    return {
      kind: "failed",
      reason: "unsupported_command",
      command: null,
      movement: null,
      idempotent: false,
      error_code: "UNSUPPORTED_CORRECTION_COMMAND",
    };
  }

  if (command.kind === "cancel") {
    return {
      kind: "cancelled",
      reason: "user_cancelled_correction",
      command,
      movement: null,
      idempotent: false,
    };
  }

  const repository = new SupabaseFinancialCoreRepository(params.client);
  const existing = await repository.getMovementById(
    params.userId,
    command.movement_id
  );

  if (!existing) {
    return {
      kind: "failed",
      reason: "movement_not_found",
      command,
      movement: null,
      idempotent: false,
      error_code: "MOVEMENT_NOT_FOUND",
    };
  }

  if (existing.deleted_at || ["deleted", "reversed"].includes(existing.status)) {
    if (command.kind === "delete") {
      return {
        kind: "applied",
        reason: "already_applied",
        command,
        movement: existing,
        idempotent: true,
        summary: summarizeCorrectionMovement(existing),
      };
    }

    return {
      kind: "failed",
      reason: "movement_inactive",
      command,
      movement: null,
      idempotent: false,
      error_code: "MOVEMENT_ALREADY_INACTIVE",
    };
  }

  if (isAlreadyApplied(existing, command)) {
    return {
      kind: "applied",
      reason: "already_applied",
      command,
      movement: existing,
      idempotent: true,
      summary: buildAppliedSummary(command, existing),
    };
  }

  const appliedSummary = buildAppliedSummary(command, existing);

  try {
    assertSystemActionAllowed({
      actionKind:
        command.kind === "delete"
          ? "destructive_financial_write"
          : "financial_correction",
      baseRiskLevel: command.kind === "delete" ? "high" : "medium",
      explicitUserConfirmation: true,
      reversible: command.kind !== "delete",
    });
    const dispatcher = new CommandDispatcher(repository);

    if (command.kind === "delete") {
      const result = await dispatcher.dispatch({
        type: "DeleteMovementCommand",
        command_id: randomUUID(),
        user_id: params.userId,
        actor: { type: "user", id: params.userId },
        source: "orchestrator.correction_confirm",
        trace_id: params.traceId,
        payload: {
          movement_id: command.movement_id,
          mode: command.delete_mode,
          reason: "user_correction_delete",
        },
      });

      return {
        kind: "applied",
        reason: "correction_applied",
        command,
        movement: result.movement,
        idempotent: false,
        summary: appliedSummary,
      };
    }

    const patch = await buildPatchForCommand(params.client, params.userId, command);
    const result = await dispatcher.dispatch({
      type: "CorrectMovementCommand",
      command_id: randomUUID(),
      user_id: params.userId,
      actor: { type: "user", id: params.userId },
      source: "orchestrator.correction_confirm",
      trace_id: params.traceId,
      payload: {
        movement_id: command.movement_id,
        corrected_fields: {
          ...patch,
          metadata: {
            ...(patch.metadata ?? {}),
            correction_source: "interactive_command",
            correction_command_id: command.command_id,
          },
        },
        user_correction_text: command.command_id,
        reason: correctionReasonForCommand(command),
      },
    });

    return {
      kind: "applied",
      reason: "correction_applied",
      command,
      movement: result.movement,
      idempotent: false,
      summary: appliedSummary,
    };
  } catch (error) {
    if (error instanceof SystemActionRiskDeniedError) {
      return {
        kind: "failed",
        reason: "risk_policy",
        command,
        movement: null,
        idempotent: false,
        error_code: error.message,
      };
    }
    if (error instanceof CorrectionReferenceError) {
      return {
        kind: "failed",
        reason: "reference_not_found",
        command,
        movement: null,
        idempotent: false,
        error_code: error.code,
      };
    }

    return {
      kind: "failed",
      reason: "core_error",
      command,
      movement: null,
      idempotent: false,
      error_code: error instanceof CoreError ? error.code : "CORE_ERROR",
    };
  }
}

export function summarizeCorrectionMovement(
  movement: Movement | RecentMovementForCorrection
): string {
  const label = humanize(movement.description ?? movement.merchant ?? "Movimiento");
  return `${label} ${formatMoney(movement.amount, movement.currency)}`;
}

async function buildPatchForCommand(
  client: Client,
  userId: string,
  command: Exclude<ExecutableCorrectionCommand, { kind: "delete" }>
): Promise<MovementPatch> {
  if (command.kind === "loan_to" || command.kind === "loan_from") {
    return buildLoanCorrectionPatch({
      targetType: command.target_type,
      relatedPersonName: command.related_person_name,
    });
  }

  if (command.kind === "amount") {
    return buildAmountCorrectionPatch({ amount: command.amount });
  }

  if (command.kind === "category") {
    const category = await getCategoryById(client, command.category_id);
    return buildCategoryCorrectionPatch({
      categoryId: command.category_id,
      categoryLabel: category?.label ?? humanizeCategoryId(command.category_id),
    });
  }

  if (
    command.kind !== "account_origin" &&
    command.kind !== "account_destination"
  ) {
    throw new CorrectionReferenceError("ACCOUNT_NOT_FOUND");
  }

  const account = await getAccountById(client, userId, command.account_id);
  if (!account) {
    throw new CorrectionReferenceError("ACCOUNT_NOT_FOUND");
  }

  return buildAccountCorrectionPatch({
    accountId: account.id,
    accountName: account.name,
    accountField: command.account_field,
  });
}

function buildAppliedSummary(
  command: ExecutableCorrectionCommand,
  movement: Movement
): string {
  const movementLabel = summarizeCorrectionMovement(movement);

  if (command.kind === "loan_to" || command.kind === "loan_from") {
    const target =
      command.target_type === "prestamo_dado"
        ? `prestamo a ${command.related_person_name}`
        : `prestamo de ${command.related_person_name}`;
    return `${movementLabel} como ${target}`;
  }

  if (command.kind === "amount") {
    return `${movementLabel} a ${formatMoney(command.amount, movement.currency)}`;
  }

  if (command.kind === "category") {
    return `${movementLabel} a categoria ${humanizeCategoryId(command.category_id)}`;
  }

  if (command.kind === "account_origin" || command.kind === "account_destination") {
    return `${movementLabel} con cuenta actualizada`;
  }

  return movementLabel;
}

function isAlreadyApplied(
  movement: Movement,
  command: ExecutableCorrectionCommand
): boolean {
  if (command.kind === "loan_to" || command.kind === "loan_from") {
    return (
      movement.type === command.target_type &&
      readString(movement.metadata.related_person_name) ===
        command.related_person_name
    );
  }

  if (command.kind === "amount") {
    return Math.abs(movement.amount - command.amount) < 0.001;
  }

  if (command.kind === "category") {
    return movement.category_id === command.category_id;
  }

  if (command.kind === "account_origin" || command.kind === "account_destination") {
    return movement[command.account_field] === command.account_id;
  }

  return false;
}

function correctionReasonForCommand(
  command: Exclude<ExecutableCorrectionCommand, { kind: "delete" }>
): "user_correction" | "classification_fix" | "account_fix" {
  if (command.kind === "category" || command.kind === "loan_to" || command.kind === "loan_from") {
    return "classification_fix";
  }

  if (command.kind === "account_origin" || command.kind === "account_destination") {
    return "account_fix";
  }

  return "user_correction";
}

function decodeAmountToken(value: string): number | null {
  const amount = Number(value.replace("_", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount * 100) / 100;
}

function formatMoney(amount: number, currency: "PEN" | "USD"): string {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}

function humanize(value: string): string {
  const text = value.trim() || "Movimiento";
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function humanizeCategoryId(value: CategoryId): string {
  return humanize(value.replace(/_/g, " "));
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

class CorrectionReferenceError extends Error {
  constructor(readonly code: "ACCOUNT_NOT_FOUND") {
    super(code);
  }
}
