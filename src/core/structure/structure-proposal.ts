import { z } from "zod";
import {
  STRUCTURE_ENTITIES,
  STRUCTURE_OPERATIONS,
  StructureCommandSchema,
  type StructureCommand,
  type StructureEntity,
} from "./structure-commands";

/**
 * `RUL-ESTR-03`: una creacion o modificacion de estructura **nunca** se
 * ejecuta sin confirmacion explicita del usuario, y viaja por el mismo camino
 * que ya usa una correccion: el bloque `propuesta` lleva `options` cuyo `id`
 * es el texto de comando, cada canal los materializa como botones, y un "si"
 * escrito se resuelve contra el estado conversacional del hilo.
 *
 * La diferencia con `corr:` es que una correccion cabe entera en el `id` del
 * boton (`corr:amount:<uuid>:<monto>`), y una caja nueva no: lleva nombre,
 * cuenta, tipo, monto apartado y meta. Por eso el `id` aqui es un **asa**
 * (`estr:<uuid>`) y el borrador tipado vive en el working set del hilo. Eso
 * ademas cierra la puerta a que alguien confirme una propuesta que el
 * asistente nunca hizo: el payload no viaja por el canal, se busca en el
 * estado del usuario.
 */

export const STRUCTURE_CANCEL_COMMAND_ID = "estr:cancel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Borrador de estructura que espera confirmacion. Vive dentro del working set
 * conversacional (JSONB), asi que es siempre del usuario dueno del hilo.
 */
export const StructureProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  entity: z.enum(STRUCTURE_ENTITIES),
  operation: z.enum(STRUCTURE_OPERATIONS),
  command_type: z.enum([
    "CreateBoxCommand",
    "UpdateBoxCommand",
    "CreateGoalCommand",
    "UpdateGoalCommand",
    "CreateBudgetCommand",
    "UpdateBudgetCommand",
  ]),
  /**
   * Payload sin envolver. Se revalida contra `StructureCommandSchema` en el
   * momento de ejecutar: el estado conversacional es un transporte, no una
   * autoridad de tipos.
   */
  payload: z.record(z.string(), z.unknown()),
  /** Frase que se le mostro al usuario. Es lo que confirma, textualmente. */
  summary: z.string().trim().min(1).max(320),
  confirm_label: z.string().trim().min(1).max(40),
  proposed_at: z.string(),
});
export type StructureProposal = z.infer<typeof StructureProposalSchema>;

export type ParsedStructureCommand =
  | { kind: "cancel"; command_id: typeof STRUCTURE_CANCEL_COMMAND_ID }
  | { kind: "confirm"; command_id: string; proposal_id: string };

/** Texto de comando que el boton devuelve al pulsarse. */
export function buildStructureCommandText(proposalId: string): string {
  return `estr:${proposalId}`;
}

export function isStructureCommandText(value: string): boolean {
  return value.trim().startsWith("estr:");
}

export function parseStructureCommandText(
  value: string,
): ParsedStructureCommand | null {
  const text = value.trim();
  if (text === STRUCTURE_CANCEL_COMMAND_ID) {
    return { kind: "cancel", command_id: STRUCTURE_CANCEL_COMMAND_ID };
  }

  const [prefix, proposalId, extra] = text.split(":");
  if (prefix !== "estr" || !proposalId || extra !== undefined) return null;
  if (!UUID_PATTERN.test(proposalId)) return null;

  return { kind: "confirm", command_id: text, proposal_id: proposalId };
}

/**
 * Reconstruye el comando tipado a partir del borrador guardado y del turno que
 * lo confirma. Devuelve `null` si el borrador no valida: un estado
 * conversacional corrupto no puede convertirse en una escritura.
 */
export function buildStructureCommandFromProposal(params: {
  proposal: StructureProposal;
  userId: string;
  commandId: string;
  source: string;
  traceId: string;
}): StructureCommand | null {
  const parsed = StructureCommandSchema.safeParse({
    type: params.proposal.command_type,
    command_id: params.commandId,
    user_id: params.userId,
    actor: { type: "user", id: params.userId },
    source: params.source,
    trace_id: params.traceId,
    // `RUL-ESTR-03`: la clave de idempotencia sale del identificador de la
    // propuesta, no del turno. Pulsar el boton dos veces, o pulsarlo y ademas
    // escribir "si", repite exactamente la misma clave.
    idempotency_key: `structure:${params.proposal.proposal_id}`,
    payload: params.proposal.payload,
  });

  return parsed.success ? parsed.data : null;
}

/** Etiqueta humana de la entidad, para componer texto sin repetir cadenas. */
export function entityLabel(entity: StructureEntity): string {
  if (entity === "caja") return "caja";
  if (entity === "meta") return "meta";
  return "presupuesto";
}
