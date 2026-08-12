import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import type { Database } from "@/data/supabase/types";
import { executeDebtActionCommand } from "./debt-action-executor";
import type { DebtActionExecutionResult } from "./debt-action-execution-result";
import {
  buildDebtActionCommandFromProposal,
  DebtActionProposalSchema,
  DEBT_ACTION_CANCEL_COMMAND_ID,
  parseDebtActionCommandText,
  type DebtActionOperation,
  type DebtActionProposal,
} from "./debt-action-proposal";

type Client = SupabaseClient<Database>;

/**
 * `23` §5b.1: una propuesta sin confirmar vale 15 minutos, o hasta que el
 * usuario cambia de tema. Es el mismo numero que una correccion, una estructura
 * y una preferencia, a proposito: el usuario no distingue "propuestas de
 * deuda" de las demas, solo recuerda lo que acaba de pedir.
 */
export const DEBT_ACTION_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

export type AwaitingDebtActionResolution =
  | { kind: "none" }
  | {
      kind: "confirmable";
      commandText: string;
      proposal: DebtActionProposal;
    }
  | {
      kind: "lapsed_confirmation";
      reason: "confirmation_window_expired" | "thread_unknown";
    }
  | { kind: "other_thread" }
  | { kind: "lapsed_by_topic_change" };

export type DebtActionResolutionResult =
  | { kind: "not_debt_command"; reason: "no_debt_command" }
  | {
      kind: "cancelled";
      reason: "user_cancelled_debt_action";
      operation: DebtActionOperation;
      catalog_command: string;
      summary: string;
    }
  | {
      kind: "applied";
      reason: "debt_action_applied" | "already_applied";
      operation: DebtActionOperation;
      catalog_command: string;
      entity_id: string;
      summary: string;
      idempotent: boolean;
    }
  | {
      kind: "failed";
      reason:
        | "unknown_proposal"
        | "invalid_proposal"
        | "proposal_lapsed"
        | "execution_failed";
      operation: DebtActionOperation | null;
      catalog_command: string | null;
      error_code: string;
      detail: string | null;
    };

/**
 * Lee el turno contra el estado del hilo y dice si hay una propuesta de deuda
 * que este turno pueda confirmar, descartar o caducar.
 *
 * Mismo contrato que `resolveAwaitingStructure`: mismo hilo, dentro de la
 * vigencia, y solo cuando el turno es una confirmacion o un descarte. Cualquier
 * otro mensaje caduca la propuesta, de modo que un "si" dicho dos temas despues
 * no cierra una deuda que el usuario ya no tiene en mente.
 */
export function resolveAwaitingDebtAction(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  threadKey: string;
  now: string;
}): AwaitingDebtActionResolution {
  const lastAction = params.workingSet?.last_action ?? null;
  const rawProposal = params.workingSet?.debt_action_proposal ?? null;

  if (
    !lastAction ||
    lastAction.kind !== "debt_action_proposed" ||
    lastAction.status !== "awaiting_confirmation" ||
    !rawProposal
  ) {
    return { kind: "none" };
  }

  const parsedProposal = DebtActionProposalSchema.safeParse(rawProposal);
  if (!parsedProposal.success) return { kind: "none" };
  const proposal = parsedProposal.data;

  const storedThreadKey = lastAction.thread_key ?? null;
  const answersTheProposal =
    isDebtActionConfirmationText(params.text, proposal) ||
    isDebtActionDiscardText(params.text);

  if (storedThreadKey && storedThreadKey !== params.threadKey) {
    return { kind: "other_thread" };
  }

  if (!answersTheProposal) return { kind: "lapsed_by_topic_change" };

  if (!storedThreadKey) {
    return { kind: "lapsed_confirmation", reason: "thread_unknown" };
  }

  if (
    isConfirmationWindowExpired(lastAction.confirmation_expires_at, params.now)
  ) {
    return {
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
    };
  }

  if (isDebtActionDiscardText(params.text)) {
    return {
      kind: "confirmable",
      commandText: DEBT_ACTION_CANCEL_COMMAND_ID,
      proposal,
    };
  }

  return {
    kind: "confirmable",
    commandText: `deuda:${proposal.proposal_id}`,
    proposal,
  };
}

export function readStoredDebtActionProposal(
  workingSet: ConversationWorkingSet | null,
): DebtActionProposal | null {
  const raw = workingSet?.debt_action_proposal ?? null;
  if (!raw) return null;
  const parsed = DebtActionProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function lapsedDebtActionResolution(
  reason: "confirmation_window_expired" | "thread_unknown",
): Extract<DebtActionResolutionResult, { kind: "failed" }> {
  return {
    kind: "failed",
    reason: "proposal_lapsed",
    operation: null,
    catalog_command: null,
    error_code:
      reason === "thread_unknown"
        ? "DEBT_ACTION_PROPOSAL_THREAD_UNKNOWN"
        : "DEBT_ACTION_PROPOSAL_EXPIRED",
    detail: null,
  };
}

/**
 * Ejecuta la operacion de deuda que el usuario acaba de confirmar.
 *
 * El payload **no** viaja en el texto del comando: se busca en el borrador
 * guardado del propio usuario. Un `deuda:<uuid>` inventado no encuentra
 * borrador y no escribe nada, y un borrador de otro usuario nunca esta en este
 * working set porque el estado conversacional se lee por `user_id`. Aqui esa
 * separacion importa mas que en estructura: si el payload viajara por el canal,
 * bastaria con retocarlo para convertir una condonacion en un pago inexistente.
 */
export async function maybeResolveDebtAction(params: {
  client: Client;
  userId: string;
  text: string;
  proposal: DebtActionProposal | null;
  traceId: string;
  source: string;
}): Promise<DebtActionResolutionResult> {
  const command = parseDebtActionCommandText(params.text);
  if (!command) {
    return { kind: "not_debt_command", reason: "no_debt_command" };
  }

  const proposal = params.proposal;

  if (command.kind === "cancel") {
    return {
      kind: "cancelled",
      reason: "user_cancelled_debt_action",
      operation: proposal?.operation ?? "close",
      catalog_command: proposal?.catalog_command ?? "cerrar_deuda",
      summary: proposal?.summary ?? "eso",
    };
  }

  if (!proposal || proposal.proposal_id !== command.proposal_id) {
    return {
      kind: "failed",
      reason: "unknown_proposal",
      operation: null,
      catalog_command: null,
      error_code: "DEBT_ACTION_PROPOSAL_NOT_FOUND",
      detail: null,
    };
  }

  const debtCommand = buildDebtActionCommandFromProposal(proposal);
  if (!debtCommand) {
    return {
      kind: "failed",
      reason: "invalid_proposal",
      operation: proposal.operation,
      catalog_command: proposal.catalog_command,
      error_code: "DEBT_ACTION_PROPOSAL_INVALID",
      detail: null,
    };
  }

  const execution: DebtActionExecutionResult = await executeDebtActionCommand({
    client: params.client,
    userId: params.userId,
    command: debtCommand,
    source: params.source,
    traceId: params.traceId,
  });

  if (execution.kind === "failed") {
    return {
      kind: "failed",
      reason: "execution_failed",
      operation: execution.operation,
      catalog_command: execution.catalog_command,
      error_code: execution.error_code,
      detail: execution.detail,
    };
  }

  return {
    kind: "applied",
    reason: execution.idempotent ? "already_applied" : "debt_action_applied",
    operation: execution.operation,
    catalog_command: execution.catalog_command,
    entity_id: execution.entity_id,
    summary: execution.summary,
    idempotent: execution.idempotent,
  };
}

/**
 * Vocabulario de confirmacion **propio** del dominio de deudas.
 *
 * No reutiliza el de estructura ni el de preferencias a proposito, y no por
 * gusto de duplicar: los tres se parecen y significan cosas distintas.
 *
 *  - El de preferencias empieza por `/^no\b/` para el descarte, y ahi "no me
 *    avises" significa **si**.
 *  - El de estructura acepta "olvidalo" como descarte y "crea/creala/hazlo"
 *    como confirmacion; ninguno de los dos verbos aparece en un cierre.
 *  - Y aqui hay una trampa que no existe en los otros dos: en deudas, "ya
 *    está", "ya la pagué" o "listo" son a la vez la forma natural de **pedir**
 *    un cierre y la forma natural de **confirmarlo**. Como esta funcion solo
 *    corre cuando ya hay un borrador vivo del mismo hilo, en ese contexto son
 *    confirmacion; el turno que las dijo por primera vez las leyo el ejecutivo.
 *
 * `contradiceElBorrador` es la segunda mitad, y es la que impide el error caro:
 * un "sí, pero como pagada" sobre una propuesta de condonacion **no** la
 * confirma. Nombrar la otra opcion nunca confirma la que esta sobre la mesa.
 */
export function isDebtActionConfirmationText(
  value: string,
  proposal?: DebtActionProposal | null,
): boolean {
  if (isDebtActionDiscardText(value)) return false;

  const text = normalizeDebtAnswer(value);
  if (!text) return false;

  if (proposal && contradiceElBorrador(text, proposal)) return false;

  return (
    /^(si|sip|claro|dale|ok|okay|listo|va|correcto|exacto|eso|asi es|ya esta|ya)$/.test(
      text,
    ) ||
    /^(si|claro|dale|ok|okay|listo|va|correcto)\b.*\b(cierra|cierrala|cierralo|ciérrala|reabre|reabrela|muevela|movela|saltala|omitela|agregalo|agregala|hazlo|hazla|adelante|dale|confirmo)\b/.test(
      text,
    ) ||
    /^(cierrala|cierralo|cierra|reabrela|reabre|muevela|saltala|omitela|agregalo|agregala|hazlo|hazla|adelante|confirmo|confirma|confirmar)\b/.test(
      text,
    ) ||
    /^(si|dale|ok)\b.*\b(perdonada|condonada|pagada)\b/.test(text)
  );
}

/**
 * Hermana de `isDebtActionConfirmationText` para el descarte.
 *
 * `cancela` entra aqui aunque en deudas sea genuinamente ambigua —"cancélala"
 * puede querer decir "cancela la propuesta" o "cancela la deuda", que es
 * condonarla—. Se resuelve siempre como descarte porque descartar no escribe:
 * si de verdad queria condonarla, el turno siguiente lo vuelve a proponer con
 * la cifra delante. La lectura contraria cerraria una deuda por una palabra
 * ambigua.
 */
export function isDebtActionDiscardText(value: string): boolean {
  const text = normalizeDebtAnswer(value);
  if (!text) return false;

  return (
    /^no\b/.test(text) ||
    /^(cancela|cancelar|cancelalo|cancelala|descarta|descartar|descartalo|dejalo|olvidalo|mejor no|todavia no|aun no|espera)\b/.test(
      text,
    ) ||
    /\b(mejor no|dejalo asi|asi no|no la cierres|no lo cierres|no la reabras|no la muevas|no la saltes)\b/.test(
      text,
    )
  );
}

/**
 * `RUL-DEUDAS-13`: pagada y condonada no son matices del mismo cierre. Si el
 * turno nombra la que **no** esta propuesta, no es una confirmacion aunque
 * empiece por "si": es una correccion, y se trata como descarte para que el
 * turno siguiente proponga la correcta.
 */
function contradiceElBorrador(
  text: string,
  proposal: DebtActionProposal,
): boolean {
  if (proposal.operation !== "close") return false;
  const reason = (proposal.payload as { reason?: unknown }).reason;

  const dicePagada = /\b(pagada|pague|la pague)\b/.test(text);
  const diceCondonada =
    /\b(perdonada|perdonaron|condonada|condonar|regalo|no la pague)\b/.test(
      text,
    );

  if (reason === "paid" && diceCondonada) return true;
  if (reason === "forgiven" && dicePagada) return true;
  return false;
}

function normalizeDebtAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sin sello de vigencia, la propuesta se considera vencida: el lado seguro. */
function isConfirmationWindowExpired(
  confirmationExpiresAt: string | null | undefined,
  now: string,
): boolean {
  if (!confirmationExpiresAt) return true;
  const expiresAt = Date.parse(confirmationExpiresAt);
  const current = Date.parse(now);
  if (Number.isNaN(expiresAt) || Number.isNaN(current)) return true;
  return current >= expiresAt;
}
