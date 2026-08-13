import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import type { Database } from "@/data/supabase/types";
import type { Movement } from "@/shared/types/domain";
import { executeMovementActionCommand } from "./movement-action-executor";
import type { MovementActionExecutionResult } from "./movement-action-execution-result";
import {
  buildMovementActionCommandFromProposal,
  MovementActionProposalSchema,
  MOVEMENT_ACTION_CANCEL_COMMAND_ID,
  parseMovementActionCommandText,
  type MovementActionOperation,
  type MovementActionProposal,
} from "./movement-action-proposal";

type Client = SupabaseClient<Database>;

/** `23` §5b.1: 15 minutos o hasta cambiar de tema, igual que los demas dominios. */
export const MOVEMENT_ACTION_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

export type AwaitingMovementActionResolution =
  | { kind: "none" }
  | {
      kind: "confirmable";
      commandText: string;
      proposal: MovementActionProposal;
    }
  | {
      kind: "lapsed_confirmation";
      reason: "confirmation_window_expired" | "thread_unknown";
    }
  | { kind: "other_thread" }
  | { kind: "lapsed_by_topic_change" };

export type MovementActionResolutionResult =
  | { kind: "not_movement_action_command"; reason: "no_movement_action_command" }
  | {
      kind: "cancelled";
      reason: "user_cancelled_movement_action";
      operation: MovementActionOperation;
      catalog_command: string;
      summary: string;
    }
  | {
      kind: "applied";
      reason: "movement_action_applied" | "already_applied";
      operation: MovementActionOperation;
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
      operation: MovementActionOperation | null;
      catalog_command: string | null;
      error_code: string;
      detail: string | null;
    };

export function resolveAwaitingMovementAction(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  threadKey: string;
  now: string;
}): AwaitingMovementActionResolution {
  const lastAction = params.workingSet?.last_action ?? null;
  const rawProposal = params.workingSet?.movement_action_proposal ?? null;

  if (
    !lastAction ||
    lastAction.kind !== "movement_action_proposed" ||
    lastAction.status !== "awaiting_confirmation" ||
    !rawProposal
  ) {
    return { kind: "none" };
  }

  const parsedProposal = MovementActionProposalSchema.safeParse(rawProposal);
  if (!parsedProposal.success) return { kind: "none" };
  const proposal = parsedProposal.data;

  const storedThreadKey = lastAction.thread_key ?? null;
  const answersTheProposal =
    isMovementActionConfirmationText(params.text) ||
    isMovementActionDiscardText(params.text);

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

  if (isMovementActionDiscardText(params.text)) {
    return {
      kind: "confirmable",
      commandText: MOVEMENT_ACTION_CANCEL_COMMAND_ID,
      proposal,
    };
  }

  return {
    kind: "confirmable",
    commandText: `mov:${proposal.proposal_id}`,
    proposal,
  };
}

export function readStoredMovementActionProposal(
  workingSet: ConversationWorkingSet | null,
): MovementActionProposal | null {
  const raw = workingSet?.movement_action_proposal ?? null;
  if (!raw) return null;
  const parsed = MovementActionProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export function lapsedMovementActionResolution(
  reason: "confirmation_window_expired" | "thread_unknown",
): Extract<MovementActionResolutionResult, { kind: "failed" }> {
  return {
    kind: "failed",
    reason: "proposal_lapsed",
    operation: null,
    catalog_command: null,
    error_code:
      reason === "thread_unknown"
        ? "MOVEMENT_ACTION_PROPOSAL_THREAD_UNKNOWN"
        : "MOVEMENT_ACTION_PROPOSAL_EXPIRED",
    detail: null,
  };
}

export async function maybeResolveMovementAction(params: {
  client: Client;
  userId: string;
  text: string;
  proposal: MovementActionProposal | null;
  movementSource: Movement["source"];
  traceId: string;
  source: string;
}): Promise<MovementActionResolutionResult> {
  const command = parseMovementActionCommandText(params.text);
  if (!command) {
    return {
      kind: "not_movement_action_command",
      reason: "no_movement_action_command",
    };
  }

  const proposal = params.proposal;

  if (command.kind === "cancel") {
    return {
      kind: "cancelled",
      reason: "user_cancelled_movement_action",
      operation: proposal?.operation ?? "duplicate",
      catalog_command: proposal?.catalog_command ?? "duplicar_movimiento",
      summary: proposal?.summary ?? "eso",
    };
  }

  if (!proposal || proposal.proposal_id !== command.proposal_id) {
    return {
      kind: "failed",
      reason: "unknown_proposal",
      operation: null,
      catalog_command: null,
      error_code: "MOVEMENT_ACTION_PROPOSAL_NOT_FOUND",
      detail: null,
    };
  }

  const movementActionCommand = buildMovementActionCommandFromProposal(proposal);
  if (!movementActionCommand) {
    return {
      kind: "failed",
      reason: "invalid_proposal",
      operation: proposal.operation,
      catalog_command: proposal.catalog_command,
      error_code: "MOVEMENT_ACTION_PROPOSAL_INVALID",
      detail: null,
    };
  }

  const execution: MovementActionExecutionResult =
    await executeMovementActionCommand({
      client: params.client,
      userId: params.userId,
      command: movementActionCommand,
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
    reason: execution.idempotent ? "already_applied" : "movement_action_applied",
    operation: execution.operation,
    catalog_command: execution.catalog_command,
    entity_id: execution.entity_id,
    summary: execution.summary,
    idempotent: execution.idempotent,
  };
}

/** Vocabulario de confirmacion/descarte propio de movimientos. */
export function isMovementActionConfirmationText(value: string): boolean {
  if (isMovementActionDiscardText(value)) return false;

  const text = normalizeMovementActionAnswer(value);
  if (!text) return false;

  return (
    /^(si|sip|claro|dale|ok|okay|listo|va|correcto|exacto|adelante|confirmo)$/.test(
      text,
    ) ||
    /^(si|claro|dale|ok|okay|listo|va|correcto)\b.*\b(restauralo|restaurala|duplicalo|duplicala|hazlo|hazla|adelante|confirmo)\b/.test(
      text,
    ) ||
    /^(restauralo|restaurala|duplicalo|duplicala|hazlo|hazla|adelante|confirmo|confirma|confirmar)\b/.test(
      text,
    )
  );
}

export function isMovementActionDiscardText(value: string): boolean {
  const text = normalizeMovementActionAnswer(value);
  if (!text) return false;

  return (
    /^no\b/.test(text) ||
    /^(cancela|cancelar|cancelalo|cancelala|descarta|descartar|descartalo|dejalo|olvidalo|mejor no|todavia no|aun no|espera)\b/.test(
      text,
    )
  );
}

function normalizeMovementActionAnswer(value: string): string {
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
