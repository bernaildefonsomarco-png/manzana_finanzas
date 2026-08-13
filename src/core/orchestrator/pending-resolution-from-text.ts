import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "@/core/channel/types";
import {
  confirmPendingItemWithCore,
  PendingConfirmationValidationError,
  PendingDuplicateConfirmationRequiredError,
} from "@/core/pending/confirm-pending";
import {
  buildPendingItemReferenceCode,
  extractPendingReferenceCode,
} from "@/core/pending/reference-code";
import {
  listPendingItems,
  hasPendingDuplicateConfirmation,
  markPendingDiscarded,
} from "@/data/repositories/pending.repository";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  reviewOrUpdatePendingAccounts,
  type PendingAccountOption,
  type PendingAccountReviewAction,
} from "@/core/pending/pending-account-review";
import type { Database } from "@/data/supabase/types";
import type {
  CategoryId,
  Movement,
  PendingItem,
} from "@/shared/types/domain";

type Client = SupabaseClient<Database>;

export type PendingResolutionAction =
  | "confirm"
  | "discard"
  | "list"
  | PendingAccountReviewAction;

export type PendingResolutionResult =
  | {
      kind: "not_resolution";
      reason: "no_pending_resolution_intent";
      action: null;
      pending_code: null;
      pending_count: 0;
      pending_item: null;
      movement: null;
      idempotent: false;
    }
  | {
      kind: "needs_clarification";
      reason:
        | "no_active_pending"
        | "multiple_active_pending"
        | "pending_code_not_found"
        | "pending_code_ambiguous"
        | "possible_duplicate"
        | "pending_requires_details"
        | "account_not_found"
        | "account_currency_mismatch"
        | "transfer_accounts_must_differ"
        | "pending_account_action_not_supported";
      action: PendingResolutionAction;
      pending_code: string | null;
      pending_count: number;
      pending_item: PendingItem | null;
      account_options?: PendingAccountOption[];
      movement: null;
      idempotent: false;
    }
  | {
      kind: "confirmed";
      reason: "single_pending_confirmed" | "pending_auto_resolved_duplicate";
      action: "confirm";
      pending_code: string | null;
      pending_count: 1;
      pending_item: PendingItem;
      movement: Movement;
      idempotent: boolean;
    }
  | {
      kind: "discarded";
      reason: "single_pending_discarded";
      action: "discard";
      pending_code: string | null;
      pending_count: 1;
      pending_item: PendingItem;
      movement: null;
      idempotent: false;
    }
  | {
      kind: "reviewed";
      reason: "pending_account_options_proposed";
      action: "review";
      pending_code: string | null;
      pending_count: 1;
      pending_item: PendingItem;
      account_options: PendingAccountOption[];
      movement: null;
      idempotent: false;
    }
  | {
      kind: "updated";
      reason:
        | "pending_ready_for_confirmation"
        | "pending_still_requires_details";
      action:
        | "assign_transfer"
        | "classify_expense"
        | "classify_income";
      pending_code: string | null;
      pending_count: 1;
      pending_item: PendingItem;
      account_options: PendingAccountOption[];
      ready_for_confirmation: boolean;
      learned_account_hints: string[];
      movement: null;
      idempotent: false;
    }
  | {
      kind: "listed";
      reason: "active_pending_listed" | "no_active_pending_to_list";
      action: "list";
      pending_code: null;
      pending_count: number;
      pending_items: PendingItem[];
      pending_item: null;
      movement: null;
      idempotent: false;
    };

export async function maybeResolvePendingFromText(params: {
  client: Client;
  userId: string;
  text: string;
  traceId: string;
  channel: Channel;
}): Promise<PendingResolutionResult> {
  const action = getPendingResolutionAction(params.text);
  const pendingCode = extractPendingReferenceCode(params.text);

  if (!action) {
    return notPendingResolution();
  }

  return resolvePendingFromAction({
    client: params.client,
    userId: params.userId,
    action,
    pendingCode,
    traceId: params.traceId,
    userText: params.text,
    channel: params.channel,
  });
}

export async function resolvePendingFromAction(params: {
  client: Client;
  userId: string;
  action: PendingResolutionAction;
  pendingCode: string | null;
  accountOriginId?: string | null;
  accountDestinationId?: string | null;
  categoryId?: CategoryId | null;
  learnAccountAliases?: boolean;
  userText?: string;
  traceId: string;
  channel: Channel;
}): Promise<PendingResolutionResult> {
  const { action, pendingCode } = params;

  if (action === "list") {
    const activePending = await listPendingItems(params.client, params.userId, {
      limit: 5,
    });

    return {
      kind: "listed",
      reason:
        activePending.length === 0
          ? "no_active_pending_to_list"
          : "active_pending_listed",
      action,
      pending_code: null,
      pending_count: activePending.length,
      pending_items: activePending,
      pending_item: null,
      movement: null,
      idempotent: false,
    };
  }

  const activePending = await listPendingItems(params.client, params.userId, {
    limit: pendingCode ? 50 : 2,
  });

  if (activePending.length === 0) {
    return {
      kind: "needs_clarification",
      reason: "no_active_pending",
      action,
      pending_code: pendingCode,
      pending_count: 0,
      pending_item: null,
      movement: null,
      idempotent: false,
    };
  }

  if (pendingCode) {
    const matchingPending = activePending.filter(
      (item) => buildPendingItemReferenceCode(item) === pendingCode
    );

    if (matchingPending.length === 0) {
      return {
        kind: "needs_clarification",
        reason: "pending_code_not_found",
        action,
        pending_code: pendingCode,
        pending_count: activePending.length,
        pending_item: null,
        movement: null,
        idempotent: false,
      };
    }

    if (matchingPending.length > 1) {
      return {
        kind: "needs_clarification",
        reason: "pending_code_ambiguous",
        action,
        pending_code: pendingCode,
        pending_count: matchingPending.length,
        pending_item: null,
        movement: null,
        idempotent: false,
      };
    }

    return resolveSinglePending({
      client: params.client,
      userId: params.userId,
      action,
      pendingCode,
      pendingItem: matchingPending[0],
      traceId: params.traceId,
      accountOriginId: params.accountOriginId,
      accountDestinationId: params.accountDestinationId,
      categoryId: params.categoryId,
      learnAccountAliases: params.learnAccountAliases,
      userText: params.userText,
      channel: params.channel,
    });
  }

  if (activePending.length > 1) {
    return {
      kind: "needs_clarification",
      reason: "multiple_active_pending",
      action,
      pending_code: null,
      pending_count: activePending.length,
      pending_item: null,
      movement: null,
      idempotent: false,
    };
  }

  return resolveSinglePending({
    client: params.client,
    userId: params.userId,
    action,
    pendingCode,
    pendingItem: activePending[0],
    traceId: params.traceId,
    accountOriginId: params.accountOriginId,
    accountDestinationId: params.accountDestinationId,
    categoryId: params.categoryId,
    learnAccountAliases: params.learnAccountAliases,
    userText: params.userText,
    channel: params.channel,
  });
}

export function notPendingResolution(): PendingResolutionResult {
  return {
    kind: "not_resolution",
    reason: "no_pending_resolution_intent",
    action: null,
    pending_code: null,
    pending_count: 0,
    pending_item: null,
    movement: null,
    idempotent: false,
  };
}

export function isStructuredPendingResolutionText(value: string): boolean {
  return Boolean(
    extractPendingReferenceCode(value) && getPendingResolutionAction(value),
  );
}

async function resolveSinglePending(params: {
  client: Client;
  userId: string;
  action: Exclude<PendingResolutionAction, "list">;
  pendingCode: string | null;
  pendingItem: PendingItem;
  accountOriginId?: string | null;
  accountDestinationId?: string | null;
  categoryId?: CategoryId | null;
  learnAccountAliases?: boolean;
  userText?: string;
  traceId: string;
  channel: Channel;
}): Promise<Extract<
  PendingResolutionResult,
  {
    kind:
      | "confirmed"
      | "discarded"
      | "reviewed"
      | "updated"
      | "needs_clarification";
  }
>> {
  if (
    isPendingAccountReviewAction(params.action) ||
    (params.action === "confirm" &&
      params.pendingItem.proposed_action.action === "review_specialized")
  ) {
    assertSystemActionAllowed({
      actionKind: "pending_resolution",
      explicitUserConfirmation: true,
      reversible: true,
    });
    const action =
      params.action === "confirm" ? "review" : params.action;
    const outcome = await reviewOrUpdatePendingAccounts({
      client: params.client,
      userId: params.userId,
      pendingItem: params.pendingItem,
      action,
      accountOriginId: params.accountOriginId,
      accountDestinationId: params.accountDestinationId,
      categoryId: params.categoryId,
      learnAccountAliases: params.learnAccountAliases,
      userText: params.userText,
      traceId: params.traceId,
    });
    if (outcome.kind === "needs_clarification") {
      return {
        kind: "needs_clarification",
        reason: outcome.reason,
        action,
        pending_code: params.pendingCode,
        pending_count: 1,
        pending_item: outcome.pendingItem,
        account_options: outcome.accountOptions,
        movement: null,
        idempotent: false,
      };
    }
    if (outcome.kind === "reviewed") {
      return {
        kind: "reviewed",
        reason: outcome.reason,
        action: "review",
        pending_code: params.pendingCode,
        pending_count: 1,
        pending_item: outcome.pendingItem,
        account_options: outcome.accountOptions,
        movement: null,
        idempotent: false,
      };
    }
    return {
      kind: "updated",
      reason: outcome.reason,
      action: action as Exclude<PendingAccountReviewAction, "review">,
      pending_code: params.pendingCode,
      pending_count: 1,
      pending_item: outcome.pendingItem,
      account_options: outcome.accountOptions,
      ready_for_confirmation: outcome.readyForConfirmation,
      learned_account_hints: outcome.learnedHints,
      movement: null,
      idempotent: false,
    };
  }

  assertSystemActionAllowed({
    actionKind: "pending_resolution",
    explicitUserConfirmation: true,
    reversible: params.action === "discard",
  });

  if (params.action === "discard") {
    const pendingItem = await markPendingDiscarded(
      params.client,
      params.userId,
      params.pendingItem.id,
      "user_discarded_single_pending",
      params.userId,
      params.traceId
    );

    return {
      kind: "discarded",
      reason: "single_pending_discarded",
      action: params.action,
      pending_code: params.pendingCode,
      pending_count: 1,
      pending_item: pendingItem,
      movement: null,
      idempotent: false,
    };
  }

  let confirmation;
  try {
    confirmation = await confirmPendingItemWithCore({
      client: params.client,
      userId: params.userId,
      pendingItemId: params.pendingItem.id,
      actor: { type: "user", id: params.userId },
      source: "orchestrator.pending_confirm",
      traceId: params.traceId,
      confirmDuplicate: hasPendingDuplicateConfirmation(params.pendingItem),
      channel: params.channel,
    });
  } catch (error) {
    if (error instanceof PendingDuplicateConfirmationRequiredError) {
      return {
        kind: "needs_clarification",
        reason: "possible_duplicate",
        action: "confirm",
        pending_code: params.pendingCode,
        pending_count: 1,
        pending_item: error.pendingItem,
        movement: null,
        idempotent: false,
      };
    }
    if (error instanceof PendingConfirmationValidationError) {
      return {
        kind: "needs_clarification",
        reason: "pending_requires_details",
        action: "confirm",
        pending_code: params.pendingCode,
        pending_count: 1,
        pending_item: params.pendingItem,
        movement: null,
        idempotent: false,
      };
    }
    throw error;
  }

  return {
    kind: "confirmed",
    reason: confirmation.autoResolvedDuplicate
      ? "pending_auto_resolved_duplicate"
      : "single_pending_confirmed",
    action: params.action,
    pending_code: params.pendingCode,
    pending_count: 1,
    pending_item: confirmation.pendingItem,
    movement: confirmation.movement,
    idempotent: confirmation.idempotent,
  };
}

export function getPendingResolutionAction(
  value: string
): PendingResolutionAction | null {
  if (isPendingListText(value)) return "list";
  if (isDiscardText(value)) return "discard";
  if (isConfirmationText(value)) return "confirm";
  if (isPendingReviewText(value)) return "review";
  if (extractPendingReferenceCode(value)) {
    const text = normalize(value);
    if (/\b(gasto|compra|pago a un tercero|pago externo)\b/.test(text)) {
      return "classify_expense";
    }
    if (/\b(ingreso|deposito|abono externo)\b/.test(text)) {
      return "classify_income";
    }
    if (
      /\b(transferencia|cuenta origen|cuenta destino)\b/.test(text) ||
      /\bde\b.+\ba\b/.test(text)
    ) {
      return "assign_transfer";
    }
  }
  return null;
}

export function isPendingReviewText(value: string): boolean {
  const text = normalize(value);
  if (!text) return false;
  return Boolean(
    extractPendingReferenceCode(value) &&
      /\b(revisar|revisa|ver opciones|completar|corregir)\b/.test(text),
  );
}

export function isPendingListText(value: string): boolean {
  const text = normalize(value);
  if (!text) return false;

  return (
    text === "pendientes" ||
    text === "ver pendientes" ||
    text === "mis pendientes" ||
    text === "muestrame pendientes" ||
    text === "mostrar pendientes" ||
    text === "que pendientes tengo" ||
    text === "que tengo pendiente" ||
    /\b(ver|mostrar|muestrame|revisar|lista|listar)\s+(mis\s+)?pendientes\b/.test(
      text
    )
  );
}

/**
 * Afirmaciones sueltas sin ningun verbo: "si", "dale", "ok". No cargan
 * contenido especifico de ninguna accion, asi que valen igual para confirmar
 * un pendiente, una correccion o una propuesta de estructura.
 */
const GENERIC_AFFIRMATIONS = "si|sip|claro|dale|ok|okay|listo|va|dalee";

/**
 * Verbos de "ejecuta lo propuesto" que no describen una accion concreta
 * (a diferencia de "eliminalo" o "cambialo"): valen para confirmar cualquier
 * tipo de propuesta porque no afirman nada sobre CUAL accion se esta
 * ejecutando, solo que se ejecute.
 */
const GENERIC_CONFIRMATION_VERBS = "confirmo|confirma|confirmar|hazlo|hazla|adelante";

/**
 * Verbos de accion correctiva/destructiva: "eliminalo", "cambialo". Estos SI
 * describen una accion concreta, y esa accion solo coincide con lo que
 * "confirmar" significa cuando la propuesta pendiente ES exactamente esa
 * accion (una correccion o un comando de estructura ya armado). En la
 * resolucion generica de pendientes (`getPendingResolutionAction`) "confirmar"
 * significa aceptar la clasificacion propuesta, no borrar el registro, asi
 * que ahi "eliminalo" leeria mejor como descarte que como confirmacion — por
 * eso este vocabulario queda detras del parametro `includeCorrectiveVerbs` en
 * vez de sumarse sin condiciones.
 */
const CORRECTIVE_CONFIRMATION_VERBS =
  "eliminalo|borralo|cambialo|corrigelo|arreglalo";

export interface ConfirmationTextOptions {
  /**
   * Suma el vocabulario de {@link CORRECTIVE_CONFIRMATION_VERBS}. Solo debe
   * activarse cuando "confirmar" equivale a "ejecuta el comando puntual que
   * ya se propuso" (correcciones): ahi el verbo que dice el usuario coincide
   * con la accion que se va a ejecutar. `correction-resolution.ts` es hoy el
   * unico llamador que lo activa.
   */
  includeCorrectiveVerbs?: boolean;
}

export function isConfirmationText(
  value: string,
  options: ConfirmationTextOptions = {}
): boolean {
  const text = normalize(value);
  if (!text) return false;

  if (
    /\b(cancelar|cancela|descarta|descartar)\b/.test(text) ||
    /\b(no|nunca)\s+(confirmes|confirmo|confirmar|registres|registrar|guardes|guardar|anotes|apuntes|elimines|borres|cambies|corrijas|arregles|hagas)\b/.test(
      text
    )
  ) {
    return false;
  }

  if (
    extractPendingReferenceCode(value) &&
    /\b(confirmo|confirma|confirmar|registralo|guardalo)\b/.test(text)
  ) {
    return true;
  }

  const confirmationVerbs = options.includeCorrectiveVerbs
    ? `${GENERIC_CONFIRMATION_VERBS}|${CORRECTIVE_CONFIRMATION_VERBS}`
    : GENERIC_CONFIRMATION_VERBS;

  return (
    text === "confirmo" ||
    text === "confirmar" ||
    text === "confirma" ||
    text === "registralo" ||
    text === "guardalo" ||
    text === "guardar" ||
    new RegExp(`^(${GENERIC_AFFIRMATIONS})$`).test(text) ||
    new RegExp(
      `\\b(${GENERIC_AFFIRMATIONS})\\b.*\\b(${confirmationVerbs})\\b`
    ).test(text) ||
    new RegExp(`^(${confirmationVerbs})\\b`).test(text) ||
    /\b(confirmo|confirma|confirmar)\s+(eso|todo|pendiente)\b/.test(text) ||
    /\b(registra|registre|registralo|guarda|guardalo|guardar|anota|apunta)\s+(eso|esto|este|esta|ese|esa|el|la|gasto|movimiento|pendiente|compra)\b/.test(
      text
    )
  );
}

export function isDiscardText(value: string): boolean {
  const text = normalize(value);
  if (!text) return false;

  if (/\b(no|nunca)\s+(canceles|descartes|borres|elimines)\b/.test(text)) {
    return false;
  }

  if (
    extractPendingReferenceCode(value) &&
    /\b(cancelar|cancela|descartar|descarta|descartalo|borra|elimina)\b/.test(
      text
    )
  ) {
    return true;
  }

  return (
    text === "cancelar" ||
    text === "cancela" ||
    text === "descartar" ||
    text === "descarta" ||
    text === "descartalo" ||
    // Negativas sueltas sin verbo especifico: "no", "mejor no", "dejalo".
    // Genericas por la misma razon que las afirmaciones sueltas lo son, y de
    // riesgo acotado: el propio gate de sistema marca "discard" como
    // reversible (`assertSystemActionAllowed` en `resolveSinglePending`).
    /^no\b/.test(text) ||
    /\b(mejor no|dejalo|olvidalo|asi no)\b/.test(text) ||
    /\b(cancelar|cancela|descartar|descarta|descartalo)\s+(eso|pendiente)\b/.test(
      text
    ) ||
    /\b(borra|elimina)\s+(eso|pendiente)\b/.test(text)
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPendingAccountReviewAction(
  action: PendingResolutionAction,
): action is PendingAccountReviewAction {
  return [
    "review",
    "assign_transfer",
    "classify_expense",
    "classify_income",
  ].includes(action);
}
