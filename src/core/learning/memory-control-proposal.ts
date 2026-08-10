import { z } from "zod";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";

/**
 * `RUL-MEM-16`: olvidar o corregir un recuerdo **nunca** se ejecuta en el mismo
 * turno en que se pide.
 *
 * No es una politica inventada aqui: el catalogo (`40` §7.13) le asigna nivel
 * `tarjeta` a `olvidar_aprendizaje` y a `corregir_aprendizaje`, y `40` §3
 * define `tarjeta` como "muestra lo que va a pasar; el usuario acepta". El
 * detalle obligatorio de la tarjeta tambien lo fija el catalogo: **que se
 * conserva** al olvidar, y **lo anterior y lo nuevo** al corregir.
 *
 * `reactivar_aprendizaje` y `no_preguntar_mas` son nivel `ninguna`, asi que
 * encender y apagar el aprendizaje se ejecutan directo. Ver la memoria es una
 * lectura y no lleva comando.
 *
 * El camino es el mismo que ya usa una propuesta de estructura: el bloque
 * `propuesta` lleva `options` cuyo `id` es el texto de comando, cada canal los
 * materializa como botones, y un "si" escrito se resuelve contra el estado
 * conversacional del hilo. El `id` es un asa (`mem:<uuid>`) y el borrador vive
 * en el working set: el resumen de un recuerdo puede ser sensible y no tiene
 * por que viajar por el canal, y asi nadie confirma una propuesta que el
 * asistente nunca hizo.
 */

export const MEMORY_CANCEL_COMMAND_ID = "mem:cancel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MemoryControlProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  action: z.enum(["forget", "correct"]),
  memory_id: z.string().uuid(),
  /** El `M-XXXXXXXX` con el que el usuario ve ese recuerdo en la lista. */
  memory_code: z.string().trim().min(1).max(16),
  /**
   * Frase que se le mostro al usuario. Es lo que confirma, textualmente, e
   * incluye ya el detalle que exige el catalogo. Mismo techo que la propuesta
   * de estructura por la misma razon: el nucleo antepone texto fijo al resumen
   * y con un limite corto el borrador se guardaba pero no volvia a validar al
   * leerlo.
   */
  summary: z.string().trim().min(1).max(560),
  confirm_label: z.string().trim().min(1).max(60),
  /** Solo en `correct`: la version confirmada que reemplaza a la anterior. */
  replacement: z.string().trim().max(280).nullable(),
  proposed_at: z.string(),
});
export type MemoryControlProposal = z.infer<typeof MemoryControlProposalSchema>;

export type ParsedMemoryCommand =
  | { kind: "cancel"; command_id: typeof MEMORY_CANCEL_COMMAND_ID }
  | { kind: "confirm"; command_id: string; proposal_id: string };

/** Texto de comando que el boton devuelve al pulsarse. */
export function buildMemoryCommandText(proposalId: string): string {
  return `mem:${proposalId}`;
}

export function isMemoryCommandText(value: string): boolean {
  return value.trim().startsWith("mem:");
}

export function parseMemoryCommandText(
  value: string,
): ParsedMemoryCommand | null {
  const text = value.trim();
  if (text === MEMORY_CANCEL_COMMAND_ID) {
    return { kind: "cancel", command_id: MEMORY_CANCEL_COMMAND_ID };
  }

  const [prefix, proposalId, extra] = text.split(":");
  if (prefix !== "mem" || !proposalId || extra !== undefined) return null;
  if (!UUID_PATTERN.test(proposalId)) return null;

  return { kind: "confirm", command_id: text, proposal_id: proposalId };
}

export type AwaitingMemoryResolution =
  /** No hay ninguna orden de memoria esperando confirmacion. */
  | { kind: "none" }
  /** Confirmacion o descarte validos: mismo hilo, dentro de la vigencia. */
  | {
      kind: "confirmable";
      commandText: string;
      proposal: MemoryControlProposal;
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

/**
 * Lee el turno contra el estado del hilo y dice si hay una orden de memoria que
 * este turno pueda confirmar, descartar o caducar.
 *
 * Reproduce el contrato de `resolveAwaitingStructure`: mismo hilo, dentro de la
 * vigencia, y solo cuando el turno es una confirmacion o un descarte. Cualquier
 * otro mensaje la caduca, de modo que un "si" dicho dos temas despues no borre
 * un recuerdo que el usuario ya no tiene en mente.
 */
export function resolveAwaitingMemoryControl(params: {
  text: string;
  workingSet: ConversationWorkingSet | null;
  threadKey: string;
  now: string;
}): AwaitingMemoryResolution {
  const lastAction = params.workingSet?.last_action ?? null;
  const proposal = readStoredMemoryProposal(params.workingSet);

  if (
    !lastAction ||
    lastAction.kind !== "memory_proposed" ||
    lastAction.status !== "awaiting_confirmation" ||
    !proposal
  ) {
    return { kind: "none" };
  }

  const storedThreadKey = lastAction.thread_key ?? null;
  const answersTheProposal =
    isMemoryConfirmationText(params.text) || isMemoryDiscardText(params.text);

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

  if (isMemoryDiscardText(params.text)) {
    return {
      kind: "confirmable",
      commandText: MEMORY_CANCEL_COMMAND_ID,
      proposal,
    };
  }

  return {
    kind: "confirmable",
    commandText: buildMemoryCommandText(proposal.proposal_id),
    proposal,
  };
}

/**
 * Lee el borrador guardado en el estado del hilo, validandolo. Un estado
 * escrito por una version anterior, o corrupto, devuelve `null` en vez de
 * romper el turno entero.
 */
export function readStoredMemoryProposal(
  workingSet: ConversationWorkingSet | null,
): MemoryControlProposal | null {
  const raw = workingSet?.memory_proposal ?? null;
  if (!raw) return null;
  const parsed = MemoryControlProposalSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * `isStructureConfirmationText` **no sirve aqui**, y la razon importa: su lista
 * de descarte incluye "olvidalo" porque ante "¿creo la caja?" eso significa
 * "dejalo". Ante "¿olvido este recuerdo?" significa exactamente lo contrario.
 * Reusar ese matcher convertiria cada "si, olvidalo" en una cancelacion
 * silenciosa, que es justo el fallo que este trabajo viene a cerrar.
 *
 * Sigue siendo una lista cerrada: cualquier otra cosa caduca la propuesta en
 * vez de ejecutarla.
 */
export function isMemoryConfirmationText(value: string): boolean {
  if (isMemoryDiscardText(value)) return false;

  const text = normalizeMemoryAnswer(value);
  if (!text) return false;

  return (
    /^(si|sip|claro|dale|ok|okay|listo|va|exacto|correcto|confirmo|confirma|confirmar)$/.test(
      text,
    ) ||
    /^(si|sip|claro|dale|ok|okay|listo|va|eso|exacto|correcto)\b.*\b(olvidalo|olvidala|olvida|borralo|borrala|borra|elimina|eliminalo|quitalo|sacalo|corrigelo|corrigela|corrige|cambialo|hazlo|adelante|dale)\b/.test(
      text,
    ) ||
    /^(olvidalo|olvidala|borralo|borrala|eliminalo|eliminala|quitalo|quitala|sacalo|sacala|corrigelo|corrigela|cambialo|hazlo|adelante)\b/.test(
      text,
    )
  );
}

/** Hermana de `isMemoryConfirmationText` para el descarte. */
export function isMemoryDiscardText(value: string): boolean {
  const text = normalizeMemoryAnswer(value);
  if (!text) return false;

  return (
    /^no\b/.test(text) ||
    /^(cancelar|cancela|cancelalo|descartar|descarta|descartalo)$/.test(text) ||
    /\b(mejor no|dejalo asi|dejalo como esta|dejala asi|no lo olvides|no la olvides|no borres|no lo borres|no la borres|asi esta bien|olvidalo no)\b/.test(
      text,
    )
  );
}

function normalizeMemoryAnswer(value: string): string {
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
