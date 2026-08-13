import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import type { Database } from "@/data/supabase/types";
import type { Movement } from "@/shared/types/domain";
import { executeMoneyActionCommand } from "./money-action-executor";
import type { MoneyActionExecutionResult } from "./money-action-execution-result";
import {
  buildMoneyActionCommandFromProposal,
  MoneyActionProposalSchema,
  MONEY_ACTION_CANCEL_COMMAND_ID,
  parseMoneyActionCommandText,
  type MoneyActionOperation,
  type MoneyActionProposal,
} from "./money-action-proposal";

type Client = SupabaseClient<Database>;

/**
 * `23` §5b.1: una propuesta de dinero sin confirmar vale 15 minutos, o hasta
 * que el usuario cambia de tema. Mismo numero que deudas, estructura y
 * memoria, a proposito: el usuario no distingue tipos de propuesta, solo
 * recuerda lo que acaba de pedir.
 */
export const MONEY_ACTION_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

export type AwaitingMoneyActionResolution =
  | { kind: "none" }
  | {
      kind: "confirmable";
      commandText: string;
      proposal: MoneyActionProposal;
    }
  | {
      kind: "lapsed_confirmation";
      reason: "confirmation_window_expired" | "thread_unknown";
    }
  | { kind: "other_thread" }
  | { kind: "lapsed_by_topic_change" };

export type MoneyActionResolutionResult =
  | { kind: "not_money_action_command"; reason: "no_money_action_command" }
  | {
      kind: "cancelled";
      reason: "user_cancelled_money_action";
      operation: MoneyActionOperation;
      catalog_command: string;
      summary: string;
    }
  | {
      kind: "applied";
      reason: "money_action_applied" | "already_applied";
      operation: MoneyActionOperation;
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
      operation: MoneyActionOperation | null;
      catalog_command: string | null;
      error_code: string;
      detail: string | null;
    };

export function resolveAwaitingMoneyAction(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  threadKey: string;
  now: string;
}): AwaitingMoneyActionResolution {
  const lastAction = params.workingSet?.last_action ?? null;
  const rawProposal = params.workingSet?.money_action_proposal ?? null;

  if (
    !lastAction ||
    lastAction.kind !== "money_action_proposed" ||
    lastAction.status !== "awaiting_confirmation" ||
    !rawProposal
  ) {
    return { kind: "none" };
  }

  const parsedProposal = MoneyActionProposalSchema.safeParse(rawProposal);
  if (!parsedProposal.success) return { kind: "none" };
  const proposal = parsedProposal.data;

  const storedThreadKey = lastAction.thread_key ?? null;
  const answersTheProposal =
    isMoneyActionConfirmationText(params.text) ||
    isMoneyActionDiscardText(params.text);

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

  if (isMoneyActionDiscardText(params.text)) {
    return {
      kind: "confirmable",
      commandText: MONEY_ACTION_CANCEL_COMMAND_ID,
      proposal,
    };
  }

  return {
    kind: "confirmable",
    commandText: `dinero:${proposal.proposal_id}`,
    proposal,
  };
}

export function readStoredMoneyActionProposal(
  workingSet: ConversationWorkingSet | null,
): MoneyActionProposal | null {
  const raw = workingSet?.money_action_proposal ?? null;
  if (!raw) return null;
  const parsed = MoneyActionProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function lapsedMoneyActionResolution(
  reason: "confirmation_window_expired" | "thread_unknown",
): Extract<MoneyActionResolutionResult, { kind: "failed" }> {
  return {
    kind: "failed",
    reason: "proposal_lapsed",
    operation: null,
    catalog_command: null,
    error_code:
      reason === "thread_unknown"
        ? "MONEY_ACTION_PROPOSAL_THREAD_UNKNOWN"
        : "MONEY_ACTION_PROPOSAL_EXPIRED",
    detail: null,
  };
}

/**
 * Ejecuta el movimiento de dinero que el usuario acaba de confirmar. El
 * payload no viaja en el texto del comando: se busca en el borrador guardado
 * del propio usuario, igual que en deudas — un `dinero:<uuid>` inventado no
 * encuentra borrador y no escribe nada.
 */
export async function maybeResolveMoneyAction(params: {
  client: Client;
  userId: string;
  text: string;
  proposal: MoneyActionProposal | null;
  movementSource: Movement["source"];
  traceId: string;
  source: string;
}): Promise<MoneyActionResolutionResult> {
  const command = parseMoneyActionCommandText(params.text);
  if (!command) {
    return { kind: "not_money_action_command", reason: "no_money_action_command" };
  }

  const proposal = params.proposal;

  if (command.kind === "cancel") {
    return {
      kind: "cancelled",
      reason: "user_cancelled_money_action",
      operation: proposal?.operation ?? "transfer",
      catalog_command: proposal?.catalog_command ?? "transferir",
      summary: proposal?.summary ?? "eso",
    };
  }

  if (!proposal || proposal.proposal_id !== command.proposal_id) {
    return {
      kind: "failed",
      reason: "unknown_proposal",
      operation: null,
      catalog_command: null,
      error_code: "MONEY_ACTION_PROPOSAL_NOT_FOUND",
      detail: null,
    };
  }

  const moneyActionCommand = buildMoneyActionCommandFromProposal(proposal);
  if (!moneyActionCommand) {
    return {
      kind: "failed",
      reason: "invalid_proposal",
      operation: proposal.operation,
      catalog_command: proposal.catalog_command,
      error_code: "MONEY_ACTION_PROPOSAL_INVALID",
      detail: null,
    };
  }

  const execution: MoneyActionExecutionResult = await executeMoneyActionCommand({
    client: params.client,
    userId: params.userId,
    command: moneyActionCommand,
    movementSource: params.movementSource,
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
    reason: execution.idempotent ? "already_applied" : "money_action_applied",
    operation: execution.operation,
    catalog_command: execution.catalog_command,
    entity_id: execution.entity_id,
    summary: execution.summary,
    idempotent: execution.idempotent,
  };
}

/**
 * Vocabulario de confirmacion/descarte propio de dinero — no comparte lista
 * con deudas, estructura ni preferencias, ni siquiera cuando algun verbo
 * coincide: cada dominio tiene sus propias trampas (en deudas, "ya está"
 * confirma un cierre; aqui no hace falta esa lectura).
 */
export function isMoneyActionConfirmationText(value: string): boolean {
  if (isMoneyActionDiscardText(value)) return false;

  const text = normalizeMoneyActionAnswer(value);
  if (!text) return false;

  return (
    /^(si|sip|claro|dale|ok|okay|listo|va|correcto|exacto|adelante|confirmo)$/.test(
      text,
    ) ||
    /^(si|claro|dale|ok|okay|listo|va|correcto)\b.*\b(transfierelo|transfierela|separalo|separala|devuelvelo|devuelvela|muevelo|muevela|hazlo|hazla|adelante|confirmo)\b/.test(
      text,
    ) ||
    /^(transfierelo|transfierela|separalo|separala|devuelvelo|devuelvela|muevelo|muevela|hazlo|hazla|adelante|confirmo|confirma|confirmar)\b/.test(
      text,
    )
  );
}

export function isMoneyActionDiscardText(value: string): boolean {
  const text = normalizeMoneyActionAnswer(value);
  if (!text) return false;

  return (
    /^no\b/.test(text) ||
    /^(cancela|cancelar|cancelalo|cancelala|descarta|descartar|descartalo|dejalo|olvidalo|mejor no|todavia no|aun no|espera)\b/.test(
      text,
    )
  );
}

function normalizeMoneyActionAnswer(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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
