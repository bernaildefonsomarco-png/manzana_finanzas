import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import type { Database } from "@/data/supabase/types";
import type { MovementSource } from "@/shared/types/domain";
import {
  isConfirmationText,
  isDiscardText,
} from "@/core/orchestrator/pending-resolution-from-text";
import { executeStructureCommand } from "./structure-executor";
import type { StructureExecutionResult } from "./structure-execution-result";
import {
  buildStructureCommandFromProposal,
  parseStructureCommandText,
  StructureProposalSchema,
  STRUCTURE_CANCEL_COMMAND_ID,
  type StructureProposal,
} from "./structure-proposal";
import type { StructureEntity, StructureOperation } from "./structure-commands";

type Client = SupabaseClient<Database>;

/**
 * `23` §5b.1 aplicado a la estructura: una propuesta sin confirmar vale 15
 * minutos, o hasta que el usuario cambia de tema. Es el mismo numero que usa
 * una correccion a proposito — el usuario no distingue "propuestas de
 * correccion" de "propuestas de estructura", solo recuerda lo que acaba de
 * pedir.
 */
export const STRUCTURE_CONFIRMATION_TTL_MS = 15 * 60 * 1000;

export type AwaitingStructureResolution =
  /** No hay ninguna propuesta de estructura esperando confirmacion. */
  | { kind: "none" }
  /** Confirmacion o descarte validos: mismo hilo, dentro de la vigencia. */
  | {
      kind: "confirmable";
      commandText: string;
      proposal: StructureProposal;
    }
  /** Llego la confirmacion pero la propuesta ya no vale. Se dice, no se ejecuta. */
  | {
      kind: "lapsed_confirmation";
      reason: "confirmation_window_expired" | "thread_unknown";
    }
  /** Hay una propuesta viva pero es de otra conversacion: este turno no la toca. */
  | { kind: "other_thread" }
  /** Turno que no confirma ni descarta: la propuesta caduca por cambio de tema. */
  | { kind: "lapsed_by_topic_change" };

export type StructureResolutionResult =
  | {
      kind: "not_structure_command";
      reason: "no_structure_command";
    }
  | {
      kind: "cancelled";
      reason: "user_cancelled_structure";
      entity: StructureEntity;
      operation: StructureOperation;
      summary: string;
    }
  | {
      kind: "applied";
      reason: "structure_applied" | "already_applied";
      entity: StructureEntity;
      operation: StructureOperation;
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
      entity: StructureEntity | null;
      operation: StructureOperation | null;
      error_code: string;
      detail: string | null;
    };

/**
 * Lee el turno contra el estado del hilo y dice si hay una propuesta de
 * estructura que este turno pueda confirmar, descartar o caducar.
 *
 * Reproduce exactamente el contrato de `resolveAwaitingCorrection`: mismo
 * hilo, dentro de la vigencia, y solo cuando el turno es una confirmacion o un
 * descarte. Cualquier otro mensaje caduca la propuesta, de modo que un "si"
 * dicho dos temas despues no crea una caja que el usuario ya no tiene en
 * mente.
 */
export function resolveAwaitingStructure(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  threadKey: string;
  now: string;
}): AwaitingStructureResolution {
  const lastAction = params.workingSet?.last_action ?? null;
  const rawProposal = params.workingSet?.structure_proposal ?? null;

  if (
    !lastAction ||
    lastAction.kind !== "structure_proposed" ||
    lastAction.status !== "awaiting_confirmation" ||
    !rawProposal
  ) {
    return { kind: "none" };
  }

  const parsedProposal = StructureProposalSchema.safeParse(rawProposal);
  if (!parsedProposal.success) return { kind: "none" };
  const proposal = parsedProposal.data;

  const storedThreadKey = lastAction.thread_key ?? null;
  const answersTheProposal =
    isStructureConfirmationText(params.text) ||
    isStructureDiscardText(params.text);

  // Otra conversacion: este turno no la ejecuta ni la caduca.
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

  if (isStructureDiscardText(params.text)) {
    return {
      kind: "confirmable",
      commandText: STRUCTURE_CANCEL_COMMAND_ID,
      proposal,
    };
  }

  return {
    kind: "confirmable",
    commandText: `estr:${proposal.proposal_id}`,
    proposal,
  };
}

/**
 * Lee el borrador guardado en el estado del hilo, validandolo. Un estado
 * escrito por una version anterior, o corrupto, devuelve `null` en vez de
 * romper el turno entero.
 */
export function readStoredStructureProposal(
  workingSet: ConversationWorkingSet | null,
): StructureProposal | null {
  const raw = workingSet?.structure_proposal ?? null;
  if (!raw) return null;
  const parsed = StructureProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Resultado de una confirmacion que llego tarde o sin sello de hilo. */
export function lapsedStructureResolution(
  reason: "confirmation_window_expired" | "thread_unknown",
): Extract<StructureResolutionResult, { kind: "failed" }> {
  return {
    kind: "failed",
    reason: "proposal_lapsed",
    entity: null,
    operation: null,
    error_code:
      reason === "thread_unknown"
        ? "STRUCTURE_PROPOSAL_THREAD_UNKNOWN"
        : "STRUCTURE_PROPOSAL_EXPIRED",
    detail: null,
  };
}

/**
 * Ejecuta el comando de estructura que el usuario acaba de confirmar.
 *
 * El payload **no** viaja en el texto del comando: se busca en el borrador
 * guardado del propio usuario. Un `estr:<uuid>` inventado no encuentra
 * borrador y no escribe nada, y un borrador de otro usuario nunca esta en este
 * working set porque el estado conversacional se lee por `user_id`.
 */
export async function maybeResolveStructure(params: {
  client: Client;
  userId: string;
  text: string;
  /** Borrador vivo del hilo; `null` si no hay ninguno. */
  proposal: StructureProposal | null;
  traceId: string;
  source: string;
  movementSource: MovementSource;
}): Promise<StructureResolutionResult> {
  const command = parseStructureCommandText(params.text);
  if (!command) {
    return {
      kind: "not_structure_command",
      reason: "no_structure_command",
    };
  }

  const proposal = params.proposal;

  if (command.kind === "cancel") {
    return {
      kind: "cancelled",
      reason: "user_cancelled_structure",
      entity: proposal?.entity ?? "caja",
      operation: proposal?.operation ?? "create",
      summary: proposal?.summary ?? "eso",
    };
  }

  if (!proposal || proposal.proposal_id !== command.proposal_id) {
    return {
      kind: "failed",
      reason: "unknown_proposal",
      entity: null,
      operation: null,
      error_code: "STRUCTURE_PROPOSAL_NOT_FOUND",
      detail: null,
    };
  }

  const structureCommand = buildStructureCommandFromProposal({
    proposal,
    userId: params.userId,
    commandId: randomUUID(),
    source: params.source,
    traceId: params.traceId,
  });

  if (!structureCommand) {
    return {
      kind: "failed",
      reason: "invalid_proposal",
      entity: proposal.entity,
      operation: proposal.operation,
      error_code: "STRUCTURE_PROPOSAL_INVALID",
      detail: null,
    };
  }

  const execution: StructureExecutionResult = await executeStructureCommand({
    client: params.client,
    command: structureCommand,
    movementSource: params.movementSource,
  });

  if (execution.kind === "failed") {
    return {
      kind: "failed",
      reason: "execution_failed",
      entity: execution.entity,
      operation: execution.operation,
      error_code: execution.error_code,
      detail: execution.detail,
    };
  }

  return {
    kind: "applied",
    reason: execution.idempotent ? "already_applied" : "structure_applied",
    entity: execution.entity,
    operation: execution.operation,
    entity_id: execution.entity_id,
    summary: execution.summary,
    idempotent: execution.idempotent,
  };
}

/**
 * El vocabulario compartido de confirmacion (`isConfirmationText`) esta escrito
 * para pendientes y movimientos: acepta "si" a secas, "confirmo", "registralo".
 * Ante "¿Creo la caja Viaje?" la respuesta natural es otra —"si, crea la
 * caja", "dale, hazlo"— asi que aqui se le suman esas formas **sin tocar** el
 * matcher compartido, que ya gobierna pendientes y correcciones en produccion.
 *
 * Sigue siendo una lista cerrada: cualquier otra cosa caduca la propuesta en
 * vez de ejecutarla.
 */
export function isStructureConfirmationText(value: string): boolean {
  if (isStructureDiscardText(value)) return false;
  if (isConfirmationText(value)) return true;

  const text = normalizeStructureAnswer(value);
  if (!text) return false;

  return (
    /^(si|sip|claro|dale|ok|okay|listo|va|dalee)$/.test(text) ||
    /^(si|claro|dale|ok|okay|listo|va)\b.*\b(crea|crear|creala|crealo|hazlo|hazla|ponlo|ponla|adelante|dale)\b/.test(
      text,
    ) ||
    /^(hazlo|hazla|crea|creala|crealo|adelante)\b/.test(text)
  );
}

/** Hermana de `isStructureConfirmationText` para el descarte. */
export function isStructureDiscardText(value: string): boolean {
  if (isDiscardText(value)) return true;

  const text = normalizeStructureAnswer(value);
  if (!text) return false;

  return (
    /^no\b/.test(text) ||
    /\b(mejor no|dejalo|olvidalo|asi no|no crees|no la crees|no lo crees)\b/.test(
      text,
    )
  );
}

function normalizeStructureAnswer(value: string): string {
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
