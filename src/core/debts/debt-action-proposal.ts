import { z } from "zod";

/**
 * `RUL-DEUDAS-13` / `40` §3.1: una operacion del ciclo de vida de una deuda
 * —cerrarla, reabrirla, mover o saltar una cuota, dar de alta a una persona—
 * **nunca** se ejecuta sin confirmacion explicita, y viaja por el mismo camino
 * que ya usan una correccion, una estructura, un recuerdo y una preferencia:
 * el bloque `propuesta` lleva `options` cuyo `id` es el texto de comando, cada
 * canal los materializa como botones, y un "si" escrito se resuelve contra el
 * estado conversacional del hilo.
 *
 * El `id` es un **asa** (`deuda:<uuid>`) y el borrador tipado vive en el
 * working set del hilo, por las dos razones de `RUL-ESTR-03`: un cierre no cabe
 * entero en el `id` de un boton, y sobre todo el payload no puede viajar por el
 * canal. Aqui esa segunda razon pesa mas que en estructura: el payload de un
 * cierre lleva `reason: "paid" | "forgiven"`, y si viajara por el canal
 * bastaria con devolver un `id` retocado para convertir una condonacion en un
 * pago que nadie hizo. Se busca en el estado del propio usuario o no se ejecuta.
 */

export const DEBT_ACTION_CANCEL_COMMAND_ID = "deuda:cancel";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Las cinco operaciones que este modulo sabe ejecutar. Son deliberadamente las
 * del **ejecutor real** y no las del catalogo: `40` §7.11 nombra nueve comandos
 * de deudas, y cuatro de ellos no tienen ejecutor en V1 (`WEB-D205`,
 * `RUL-DEUDAS-11`, `RUL-DEUDAS-12`). Declarar aqui solo lo que existe hace
 * imposible construir un borrador de algo que despues no se puede aplicar; los
 * cuatro que faltan se rechazan **por su nombre** en el compilador, no aqui.
 */
export const DEBT_ACTION_OPERATIONS = [
  "close",
  "reopen",
  "reschedule_installment",
  "skip_installment",
  "create_person",
] as const;
export type DebtActionOperation = (typeof DEBT_ACTION_OPERATIONS)[number];

/**
 * `RUL-DEUDAS-13`: cerrar no es una operacion, son **dos**, y confundirlas
 * falsea el historial en la direccion mas cara posible.
 *
 *  - `paid` exige saldo cero. Dice "esto se pagó": cuenta como pago y el
 *    historial de la persona queda como el de alguien que cumplio.
 *  - `forgiven` exige saldo mayor que cero. Dice "esto no se pagó y ya no se va
 *    a pagar": persiste `cancelled`, guarda `forgiven_balance` antes de llevar
 *    el saldo a cero (`WEB-D204`) y **no** cuenta como pago.
 *
 * Nunca se cierra con una etiqueta que oculte saldo. Los dos invariantes los
 * vuelve a comprobar `commit_debt_operation` en la base
 * (`DEBT_OPERATION_PAID_WITH_BALANCE`, `DEBT_OPERATION_FORGIVEN_WITHOUT_BALANCE`),
 * asi que este tipo no es la unica defensa: es la que permite **preguntar**
 * antes de intentarlo en vez de estrellarse contra el RPC.
 */
export const DEBT_CLOSE_REASONS = ["paid", "forgiven"] as const;
export type DebtCloseReason = (typeof DEBT_CLOSE_REASONS)[number];

const CloseDebtPayloadSchema = z.object({
  debt_id: z.string().uuid(),
  reason: z.enum(DEBT_CLOSE_REASONS),
  /**
   * Saldo que el nucleo leyo al componer la propuesta. Viaja en el borrador
   * para que la frase de confirmacion pueda decir la cifra exacta que se va a
   * condonar, y para que un cambio de saldo entre la propuesta y el "si" se
   * pueda detectar en vez de aplicarse a ciegas.
   */
  balance_at_proposal: z.number().finite().min(0),
});

const ReopenDebtPayloadSchema = z.object({
  debt_id: z.string().uuid(),
});

const RescheduleInstallmentPayloadSchema = z.object({
  debt_id: z.string().uuid(),
  installment_id: z.string().uuid(),
  due_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha debe usar YYYY-MM-DD.")
    .refine(isRealIsoDate, "Esa fecha no existe."),
  reason: z.string().trim().min(1).max(180).nullable(),
});

/**
 * `RUL-DEUDAS-08`: saltar una cuota deja rastro auditable, asi que el motivo es
 * **obligatorio** —no opcional como en reprogramar—. Es la misma exigencia que
 * hace el RPC (`DEBT_OPERATION_REASON_REQUIRED`).
 */
const SkipInstallmentPayloadSchema = z.object({
  debt_id: z.string().uuid(),
  installment_id: z.string().uuid(),
  reason: z.string().trim().min(1).max(180),
});

/** `RUL-DEUDAS-15`: una persona relacionada es solo nombre, tipo y relacion. */
const CreatePersonPayloadSchema = z.object({
  display_name: z.string().trim().min(1).max(60),
  kind: z.string().trim().min(1).max(40),
  relationship_label: z.string().trim().min(1).max(60).nullable(),
});

/**
 * Borrador de deuda que espera confirmacion. Vive dentro del working set
 * conversacional (JSONB), asi que es siempre del usuario dueno del hilo.
 */
export const DebtActionProposalSchema = z.object({
  proposal_id: z.string().uuid(),
  operation: z.enum(DEBT_ACTION_OPERATIONS),
  /** Nombre de catalogo (`40` §7.11) al que corresponde. Va al audit log. */
  catalog_command: z.string().trim().min(1).max(60),
  /**
   * Payload sin envolver. Se revalida contra el esquema de su operacion en el
   * momento de ejecutar: el estado conversacional es un transporte, no una
   * autoridad de tipos.
   */
  payload: z.record(z.string(), z.unknown()),
  /**
   * Frase que se le mostro al usuario. Es lo que confirma, textualmente.
   *
   * El techo es el mismo 560 que el borrador de estructura, y por la misma
   * razon: en un cierre el nucleo antepone la consecuencia deterministica
   * (`RUL-DEUDAS-13`) a la frase del modelo, y con un techo mas corto el
   * borrador se guardaba pero no volvia a validar al leerlo.
   */
  summary: z.string().trim().min(1).max(560),
  confirm_label: z.string().trim().min(1).max(60),
  proposed_at: z.string(),
});
export type DebtActionProposal = z.infer<typeof DebtActionProposalSchema>;

/** El esquema que manda sobre el payload de cada operacion, en un solo sitio. */
const PAYLOAD_SCHEMAS: Record<DebtActionOperation, z.ZodType> = {
  close: CloseDebtPayloadSchema,
  reopen: ReopenDebtPayloadSchema,
  reschedule_installment: RescheduleInstallmentPayloadSchema,
  skip_installment: SkipInstallmentPayloadSchema,
  create_person: CreatePersonPayloadSchema,
};

export type DebtActionCommand =
  | {
      operation: "close";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof CloseDebtPayloadSchema>;
    }
  | {
      operation: "reopen";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof ReopenDebtPayloadSchema>;
    }
  | {
      operation: "reschedule_installment";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof RescheduleInstallmentPayloadSchema>;
    }
  | {
      operation: "skip_installment";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof SkipInstallmentPayloadSchema>;
    }
  | {
      operation: "create_person";
      catalog_command: string;
      idempotency_key: string;
      payload: z.infer<typeof CreatePersonPayloadSchema>;
    };

export type ParsedDebtActionCommand =
  | { kind: "cancel"; command_id: typeof DEBT_ACTION_CANCEL_COMMAND_ID }
  | { kind: "confirm"; command_id: string; proposal_id: string };

/** Texto de comando que el boton devuelve al pulsarse. */
export function buildDebtActionCommandText(proposalId: string): string {
  return `deuda:${proposalId}`;
}

export function isDebtActionCommandText(value: string): boolean {
  return value.trim().startsWith("deuda:");
}

export function parseDebtActionCommandText(
  value: string,
): ParsedDebtActionCommand | null {
  const text = value.trim();
  if (text === DEBT_ACTION_CANCEL_COMMAND_ID) {
    return { kind: "cancel", command_id: DEBT_ACTION_CANCEL_COMMAND_ID };
  }

  const [prefix, proposalId, extra] = text.split(":");
  if (prefix !== "deuda" || !proposalId || extra !== undefined) return null;
  if (!UUID_PATTERN.test(proposalId)) return null;

  return { kind: "confirm", command_id: text, proposal_id: proposalId };
}

/**
 * Reconstruye el comando tipado a partir del borrador guardado. Devuelve `null`
 * si el borrador no valida: un estado conversacional corrupto no puede
 * convertirse en una escritura.
 *
 * `40` §3.1: la clave de idempotencia sale del identificador de la **propuesta**,
 * no del turno. Pulsar el boton dos veces, o pulsarlo y ademas escribir "si",
 * repite exactamente la misma clave, y el RPC devuelve el mismo recibo en vez de
 * cerrar dos veces.
 */
export function buildDebtActionCommandFromProposal(
  proposal: DebtActionProposal,
): DebtActionCommand | null {
  const parsed = PAYLOAD_SCHEMAS[proposal.operation].safeParse(
    proposal.payload,
  );
  if (!parsed.success) return null;

  return {
    operation: proposal.operation,
    catalog_command: proposal.catalog_command,
    idempotency_key: `debt_action:${proposal.proposal_id}`,
    payload: parsed.data,
  } as DebtActionCommand;
}

function isRealIsoDate(value: string): boolean {
  const instant = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instant.getTime()) &&
    instant.toISOString().slice(0, 10) === value
  );
}
