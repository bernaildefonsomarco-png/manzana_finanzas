import { z } from "zod";

/**
 * `26` §14.2 / `40` §3.1: restaurar y duplicar un movimiento nunca se
 * ejecutan sin confirmacion explicita. Mismo transporte que dinero y deudas:
 * asa `mov:<uuid>` en el boton, borrador tipado en el working set del hilo.
 */

export const MOVEMENT_ACTION_CANCEL_COMMAND_ID = "mov:cancel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MOVEMENT_ACTION_OPERATIONS = ["restore", "duplicate"] as const;
export type MovementActionOperation = (typeof MOVEMENT_ACTION_OPERATIONS)[number];

const RestorePayloadSchema = z.object({
  movement_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(240),
});

const DuplicatePayloadSchema = z.object({
  source_movement_id: z.string().uuid(),
  /** `null` es "ahora", resuelto por el ejecutor al confirmar. */
  occurred_at: z.string().datetime({ offset: true }).nullable(),
  amount: z
    .number()
    .finite()
    .positive("El monto debe ser mayor a cero")
    .max(999_999_999.99, "Monto demasiado alto"),
});

export const MovementActionProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  operation: z.enum(MOVEMENT_ACTION_OPERATIONS),
  /** Nombre de catalogo (`40` §7.3) al que corresponde. Va al audit log. */
  catalog_command: z.string().trim().min(1).max(60),
  payload: z.record(z.string(), z.unknown()),
  summary: z.string().trim().min(1).max(560),
  confirm_label: z.string().trim().min(1).max(60),
  proposed_at: z.string(),
});
export type MovementActionProposal = z.infer<typeof MovementActionProposalSchema>;

const PAYLOAD_SCHEMAS: Record<MovementActionOperation, z.ZodType> = {
  restore: RestorePayloadSchema,
  duplicate: DuplicatePayloadSchema,
};

export type MovementActionCommand =
  | {
      operation: "restore";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof RestorePayloadSchema>;
    }
  | {
      operation: "duplicate";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof DuplicatePayloadSchema>;
    };

export type ParsedMovementActionCommand =
  | { kind: "cancel"; command_id: typeof MOVEMENT_ACTION_CANCEL_COMMAND_ID }
  | { kind: "confirm"; command_id: string; proposal_id: string };

export function buildMovementActionCommandText(proposalId: string): string {
  return `mov:${proposalId}`;
}

export function isMovementActionCommandText(value: string): boolean {
  return value.trim().startsWith("mov:");
}

export function parseMovementActionCommandText(
  value: string,
): ParsedMovementActionCommand | null {
  const text = value.trim();
  if (text === MOVEMENT_ACTION_CANCEL_COMMAND_ID) {
    return { kind: "cancel", command_id: MOVEMENT_ACTION_CANCEL_COMMAND_ID };
  }

  const [prefix, proposalId, extra] = text.split(":");
  if (prefix !== "mov" || !proposalId || extra !== undefined) return null;
  if (!UUID_PATTERN.test(proposalId)) return null;

  return { kind: "confirm", command_id: text, proposal_id: proposalId };
}

/**
 * Reconstruye el comando tipado a partir del borrador guardado. Devuelve
 * `null` si el borrador no valida.
 *
 * La clave de idempotencia sale del identificador de la propuesta, nunca del
 * turno: pulsar el boton dos veces repite la misma clave y el
 * `CommandDispatcher` devuelve el mismo resultado en vez de restaurar o
 * duplicar dos veces.
 */
export function buildMovementActionCommandFromProposal(
  proposal: MovementActionProposal,
): MovementActionCommand | null {
  const parsed = PAYLOAD_SCHEMAS[proposal.operation].safeParse(
    proposal.payload,
  );
  if (!parsed.success) return null;

  return {
    operation: proposal.operation,
    catalog_command: proposal.catalog_command,
    idempotency_key: `movement_action:${proposal.proposal_id}`,
    payload: parsed.data,
  } as MovementActionCommand;
}
