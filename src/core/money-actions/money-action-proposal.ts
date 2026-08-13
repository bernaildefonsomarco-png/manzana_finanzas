import { z } from "zod";

/**
 * `24` §9 (`ACT-CUENTAS-10` a `13`) / `40` §3.1: mover dinero entre cuentas y
 * cajas es `tarjeta_editable` y nunca se ejecuta sin confirmacion explicita.
 * Mismo transporte que una deuda o una estructura: el `id` del boton es un
 * asa (`dinero:<uuid>`) y el borrador tipado vive en el working set del hilo
 * — el payload no cabe ni debe viajar por el canal.
 */

export const MONEY_ACTION_CANCEL_COMMAND_ID = "dinero:cancel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const MONEY_ACTION_OPERATIONS = [
  "transfer",
  "separate_to_box",
  "release_from_box",
  "box_to_box",
] as const;
export type MoneyActionOperation = (typeof MONEY_ACTION_OPERATIONS)[number];

const PositiveMoneySchema = z
  .number()
  .finite()
  .positive("El monto debe ser mayor a cero")
  .max(999_999_999.99, "Monto demasiado alto");

const OptionalDescriptionSchema = z.string().trim().min(1).max(180).nullable();

const TransferPayloadSchema = z.object({
  from_account_id: z.string().uuid(),
  to_account_id: z.string().uuid(),
  amount: PositiveMoneySchema,
  description: OptionalDescriptionSchema,
});

const SeparateToBoxPayloadSchema = z.object({
  box_destination_id: z.string().uuid(),
  amount: PositiveMoneySchema,
  description: OptionalDescriptionSchema,
});

const ReleaseFromBoxPayloadSchema = z.object({
  box_origin_id: z.string().uuid(),
  amount: PositiveMoneySchema,
  description: OptionalDescriptionSchema,
});

const BoxToBoxPayloadSchema = z.object({
  box_origin_id: z.string().uuid(),
  box_destination_id: z.string().uuid(),
  amount: PositiveMoneySchema,
  description: OptionalDescriptionSchema,
});

/** Borrador de movimiento de dinero que espera confirmacion. */
export const MoneyActionProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  operation: z.enum(MONEY_ACTION_OPERATIONS),
  /** Nombre de catalogo (`40` §7.1) al que corresponde. Va al audit log. */
  catalog_command: z.string().trim().min(1).max(60),
  payload: z.record(z.string(), z.unknown()),
  summary: z.string().trim().min(1).max(560),
  confirm_label: z.string().trim().min(1).max(60),
  proposed_at: z.string(),
});
export type MoneyActionProposal = z.infer<typeof MoneyActionProposalSchema>;

const PAYLOAD_SCHEMAS: Record<MoneyActionOperation, z.ZodType> = {
  transfer: TransferPayloadSchema,
  separate_to_box: SeparateToBoxPayloadSchema,
  release_from_box: ReleaseFromBoxPayloadSchema,
  box_to_box: BoxToBoxPayloadSchema,
};

export type MoneyActionCommand =
  | {
      operation: "transfer";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof TransferPayloadSchema>;
    }
  | {
      operation: "separate_to_box";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof SeparateToBoxPayloadSchema>;
    }
  | {
      operation: "release_from_box";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof ReleaseFromBoxPayloadSchema>;
    }
  | {
      operation: "box_to_box";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof BoxToBoxPayloadSchema>;
    };

export type ParsedMoneyActionCommand =
  | { kind: "cancel"; command_id: typeof MONEY_ACTION_CANCEL_COMMAND_ID }
  | { kind: "confirm"; command_id: string; proposal_id: string };

export function buildMoneyActionCommandText(proposalId: string): string {
  return `dinero:${proposalId}`;
}

export function isMoneyActionCommandText(value: string): boolean {
  return value.trim().startsWith("dinero:");
}

export function parseMoneyActionCommandText(
  value: string,
): ParsedMoneyActionCommand | null {
  const text = value.trim();
  if (text === MONEY_ACTION_CANCEL_COMMAND_ID) {
    return { kind: "cancel", command_id: MONEY_ACTION_CANCEL_COMMAND_ID };
  }

  const [prefix, proposalId, extra] = text.split(":");
  if (prefix !== "dinero" || !proposalId || extra !== undefined) return null;
  if (!UUID_PATTERN.test(proposalId)) return null;

  return { kind: "confirm", command_id: text, proposal_id: proposalId };
}

/**
 * Reconstruye el comando tipado a partir del borrador guardado. Devuelve
 * `null` si el borrador no valida: un estado conversacional corrupto no puede
 * convertirse en una escritura.
 *
 * La clave de idempotencia sale del identificador de la propuesta, nunca del
 * turno (mismo contrato que deudas): pulsar el boton dos veces repite la
 * misma clave y el `CommandDispatcher` devuelve el mismo movimiento en vez de
 * moverlo dos veces.
 */
export function buildMoneyActionCommandFromProposal(
  proposal: MoneyActionProposal,
): MoneyActionCommand | null {
  const parsed = PAYLOAD_SCHEMAS[proposal.operation].safeParse(
    proposal.payload,
  );
  if (!parsed.success) return null;

  return {
    operation: proposal.operation,
    catalog_command: proposal.catalog_command,
    idempotency_key: `money_action:${proposal.proposal_id}`,
    payload: parsed.data,
  } as MoneyActionCommand;
}
