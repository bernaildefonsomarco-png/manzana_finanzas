import { randomUUID } from "node:crypto";
import type { ActionRequestOutcome } from "@/core/actions/action-request-outcome";
import { NOT_REQUESTED } from "@/core/actions/action-request-outcome";
import {
  describeDebtCloseConsequence,
  describeDebtReopenConsequence,
  describeInstallmentRescheduleConsequence,
  describeInstallmentSkipConsequence,
  formatDebtMoney,
} from "./debt-action-consequences";
import {
  DebtActionProposalSchema,
  type DebtActionProposal,
  type DebtCloseReason,
} from "./debt-action-proposal";

/**
 * `RUL-DEUDAS-13`, `40` §7.11: los nueve comandos de deudas del catalogo que
 * este modulo sabe leer del turno.
 *
 * Los nombres son los del **catalogo**, no un vocabulario propio, por lo mismo
 * que en `light_action` y `preference_change`: el nivel de confirmacion de cada
 * uno ya lo decidio `40` §7 y aqui no se reinterpreta.
 *
 * Cuatro de ellos estan declarados **para poder rechazarlos con nombre propio**,
 * exactamente por la razon por la que `forget_all` existe en
 * `MemoryControlRequestSchema`: sin el valor, "súmale los intereses a la deuda
 * del banco" se leeria como otra cosa —un pago, una edicion— y podria terminar
 * tocando dinero. Declararlo permite responder que el motor no puede y dar la
 * via de pantalla (`ERR-ASI-01`) en vez de improvisar.
 */
export const DEBT_ACTION_INTENTS = [
  "none",
  "cerrar_deuda",
  "reabrir_deuda",
  "reprogramar_cuota",
  "saltar_cuota",
  "crear_persona",
  // --- Declarados solo para rechazarse por su nombre ------------------------
  "registrar_interes",
  "renegociar_deuda",
  "vincular_caja_a_deuda",
] as const;
export type DebtActionIntent = (typeof DEBT_ACTION_INTENTS)[number];

/**
 * Los comandos que existen en `40` §7.11 y que este motor **no ejecuta**, con el
 * motivo de corpus que lo decidio. No es una limitacion de implementacion que
 * alguien pueda "arreglar" añadiendo un ejecutor: es una decision de producto
 * vigente, y el texto que ve la persona sale de aqui y no del modelo.
 */
const NO_DISPONIBLES: Record<string, { reason: string; text: string }> = {
  registrar_interes: {
    reason: "web_d205_interest_adjustment_deferred",
    // No se ofrece una via manual porque `RUL-DEUDAS-11` deja el ajuste por
    // interes fuera de esta version **entera**, no solo de la conversacion:
    // tampoco hay pantalla que suba el saldo. Mandar a alguien a un sitio
    // donde no puede hacer nada es peor que decirle que no se puede.
    text: "No puedo sumar intereses ni mora al saldo de una deuda, ni desde aquí ni desde la app: en esta versión el interés se guarda como nota descriptiva, no como un cambio de lo que debes. Calcularlo mal sería peor que no calcularlo. Si lo que cambió es cuánto falta de verdad, dime el monto y lo registramos como un pago o una devolución.",
  },
  renegociar_deuda: {
    reason: "web_d205_renegotiation_deferred",
    text: "No puedo renegociar una deuda: cambiar el monto o rehacer el calendario de cuotas no está disponible todavía. Lo que sí puedo es mover la fecha de una cuota concreta sin tocar importes. Para lo demás, edita la deuda desde su pantalla.",
  },
  vincular_caja_a_deuda: {
    reason: "no_executor_for_box_debt_link",
    // Verificado: `boxes.linked_debt_id` solo se LEE en todo el repositorio
    // —la cobertura de cuotas en `debts.repository.ts`— y no hay un solo
    // `update` de esa columna, ni en la API ni en pantalla. Prometer una via
    // manual que no existe manda a la persona a buscar algo que no va a
    // encontrar, y ademas nos hace quedar como si el limite fuera solo del
    // asistente cuando es del producto.
    text: "Todavía no se puede vincular una caja a una deuda, ni desde aquí ni desde la app. Lo que sí puedo hacer es apartar el dinero en una caja para esa deuda: dime cuánto y de qué cuenta sale.",
  },
};

/** Lo que el ejecutivo entendio del turno, plano y sin comandos. */
export type DebtActionRequest = {
  intent: DebtActionIntent;
  debt_id: string;
  installment_id: string;
  close_reason: "sin_decidir" | "pagada" | "condonada";
  due_date: string;
  reason: string;
  person_name: string;
  person_relationship: string;
  confidence: number;
  ambiguities: string[];
};

/** Deuda real del usuario, tal y como la carga el turno. */
export type DebtActionDebtContext = {
  id: string;
  name: string;
  direction: "i_owe" | "they_owe_me";
  status: string;
  current_balance: number;
  currency: "PEN" | "USD";
  related_person_id: string | null;
  related_person_name: string | null;
  related_person_aliases: string[];
  installments: Array<{
    id: string;
    number: number;
    due_date: string;
    status: string;
  }>;
};

export type DebtActionPersonContext = {
  id: string;
  display_name: string;
  aliases: string[];
};

export type DebtActionCompilation = ActionRequestOutcome<DebtActionProposal>;

/** Bajo esta confianza, la propuesta no se presenta como accion. */
const MIN_DEBT_CONFIDENCE = 0.6;

/**
 * `40` §3.1: un comando de nivel `riesgo` exige mas confianza que uno de
 * `tarjeta`. Cerrar de mas no se deshace igual que reprogramar de mas: una
 * condonacion escribe en el historial que un dinero no se pagó.
 */
const MIN_RISK_CONFIDENCE = 0.75;

/** Los comandos de `40` §7.11 que llevan nivel `riesgo`. */
const RIESGO: ReadonlySet<string> = new Set(["cerrar_deuda"]);

export function compileDebtAction(input: {
  request: DebtActionRequest | null | undefined;
  /** Texto original del usuario, para los guardarrailes deterministicos. */
  userText: string;
  now: string;
  /** Deudas vivas del usuario (`active`, `due_soon`, `overdue`). */
  debts: DebtActionDebtContext[];
  /** Deudas condonadas. Solo se carga cuando el turno pide reabrir. */
  closedDebts?: DebtActionDebtContext[];
  relatedPeople: DebtActionPersonContext[];
}): DebtActionCompilation {
  const request = input.request ?? null;
  if (!request || request.intent === "none") return NOT_REQUESTED;

  const noDisponible = NO_DISPONIBLES[request.intent];
  if (noDisponible) {
    return { kind: "unavailable", reason: noDisponible.reason };
  }

  if (request.ambiguities.length > 0) {
    return { kind: "needs_clarification", question: request.ambiguities[0] };
  }

  const minConfidence = RIESGO.has(request.intent)
    ? MIN_RISK_CONFIDENCE
    : MIN_DEBT_CONFIDENCE;
  if (request.confidence < minConfidence) {
    return {
      kind: "needs_clarification",
      question: preguntaPorFaltaDeDatos(request.intent),
    };
  }

  if (request.intent === "crear_persona") {
    return compileCreatePerson(request, input.relatedPeople, input.now);
  }

  const universo =
    request.intent === "reabrir_deuda"
      ? (input.closedDebts ?? [])
      : input.debts;

  const objetivo = resolveDebt({
    request,
    userText: input.userText,
    debts: universo,
  });
  if (objetivo.kind !== "found") {
    return { kind: "needs_clarification", question: objetivo.question };
  }
  const debt = objetivo.debt;

  if (request.intent === "cerrar_deuda") {
    return compileClose(request, debt, input.now);
  }
  if (request.intent === "reabrir_deuda") {
    return compileReopen(debt, input.now);
  }
  return compileInstallment(request, debt, input.now);
}

/**
 * `RUL-DEUDAS-13` / `ERR-DEUDAS-06`: **aqui** se resuelve pagada vs. condonada,
 * antes de proponer nada, y con el saldo real del usuario en la mano.
 *
 * No es una preferencia de redaccion: son dos escrituras distintas. `paid` deja
 * constancia de que el dinero se pagó; `forgiven` deja constancia de que **no**
 * se pagó y guarda cuanto (`WEB-D204`). Elegir por el usuario en cualquiera de
 * las dos direcciones le falsea el historial, asi que ninguna de las dos se
 * infiere: o el saldo hace que solo una sea legal, o se pregunta.
 *
 * Las cuatro combinaciones, todas cubiertas:
 *
 *  | saldo | lo que dijo | que pasa |
 *  |---|---|---|
 *  | 0 | nada | `paid`, la unica legal — no se pregunta de mas |
 *  | 0 | condonada | se explica que no hay nada que perdonar y se ofrece `paid` |
 *  | > 0 | nada | **se pregunta** (`ERR-DEUDAS-06`) |
 *  | > 0 | pagada | se explica que falta saldo y se ofrecen las dos salidas |
 *  | > 0 | condonada | `forgiven`, con la cifra a la vista |
 */
function compileClose(
  request: DebtActionRequest,
  debt: DebtActionDebtContext,
  now: string,
): DebtActionCompilation {
  const saldo = redondear(debt.current_balance);
  const dicho = request.close_reason;
  const cifra = formatDebtMoney(saldo, debt.currency);

  if (saldo <= 0) {
    if (dicho === "condonada") {
      return {
        kind: "needs_clarification",
        question: `«${debt.name}» ya está en cero, así que no hay nada que perdonar: se cierra como pagada. ¿La cierro así?`,
      };
    }
    return proposeClose(debt, "paid", saldo, now);
  }

  if (dicho === "sin_decidir") {
    // `ERR-DEUDAS-06`. La pregunta lleva la cifra porque sin ella la persona no
    // puede elegir: "¿la pagaste?" con S/600 vivos es una pregunta distinta que
    // con S/5.
    return {
      kind: "needs_clarification",
      question: `De «${debt.name}» todavía me constan ${cifra} sin pagar. ¿Ya los pagaste —y los registro— o te la perdonaron? No es lo mismo: si me dices que la pagaste queda como pago tuyo, y si me dices que te la perdonaron guardo esos ${cifra} como perdonados y no cuentan como pago.`,
    };
  }

  if (dicho === "pagada") {
    // `RUL-DEUDAS-13`: `paid` exige cero. Cerrarla como pagada con saldo vivo
    // seria una etiqueta que oculta saldo, que es justo lo prohibido.
    return {
      kind: "needs_clarification",
      question: `Para cerrar «${debt.name}» como pagada su saldo tiene que estar en cero, y todavía me constan ${cifra}. ¿Registro esos ${cifra} como un pago y la cierro, o te la perdonaron?`,
    };
  }

  return proposeClose(debt, "forgiven", saldo, now);
}

function proposeClose(
  debt: DebtActionDebtContext,
  reason: DebtCloseReason,
  balance: number,
  now: string,
): DebtActionCompilation {
  const consecuencia = describeDebtCloseConsequence({
    debtName: debt.name,
    reason,
    balance,
    currency: debt.currency,
  });
  const pregunta =
    reason === "paid"
      ? `¿La cierro como pagada?`
      : `¿La cierro como condonada?`;

  return draft({
    operation: "close",
    catalogCommand: "cerrar_deuda",
    payload: {
      debt_id: debt.id,
      reason,
      balance_at_proposal: balance,
    },
    summary: `${consecuencia} ${pregunta}`,
    // El boton nombra la accion, no dice "Sí, hazlo": las dos opciones de un
    // cierre son distintas y la etiqueta es lo ultimo que la persona lee.
    confirmLabel:
      reason === "paid" ? "Sí, ciérrala como pagada" : "Sí, dala por perdonada",
    now,
  });
}

function compileReopen(
  debt: DebtActionDebtContext,
  now: string,
): DebtActionCompilation {
  return draft({
    operation: "reopen",
    catalogCommand: "reabrir_deuda",
    payload: { debt_id: debt.id },
    summary: `${describeDebtReopenConsequence({ debtName: debt.name })} ¿La reabro?`,
    confirmLabel: "Sí, reábrela",
    now,
  });
}

function compileInstallment(
  request: DebtActionRequest,
  debt: DebtActionDebtContext,
  now: string,
): DebtActionCompilation {
  const cuota = resolveInstallment(request, debt);
  if (!cuota) {
    return {
      kind: "needs_clarification",
      question: abiertasDe(debt).length
        ? `¿Cuál cuota de «${debt.name}»? Tienes abiertas ${enumerar(
            abiertasDe(debt).map(
              (item) => `la ${item.number} (vence el ${item.due_date})`,
            ),
          )}.`
        : `«${debt.name}» no tiene cuotas abiertas que pueda mover.`,
    };
  }

  if (request.intent === "saltar_cuota") {
    // `RUL-DEUDAS-08`: el motivo es obligatorio y lo pone la persona, no el
    // modelo. Sin motivo no hay rastro auditable, y el RPC lo rechazaria.
    const motivo = request.reason.trim();
    if (!motivo) {
      return {
        kind: "needs_clarification",
        question: `¿Por qué saltamos la cuota ${cuota.number} de «${debt.name}»? Lo guardo como motivo, y ojo: saltarla no reduce lo que debes.`,
      };
    }
    return draft({
      operation: "skip_installment",
      catalogCommand: "saltar_cuota",
      payload: {
        debt_id: debt.id,
        installment_id: cuota.id,
        reason: motivo,
      },
      summary: `${describeInstallmentSkipConsequence({
        installmentNumber: cuota.number,
        debtName: debt.name,
      })} ¿La marco como omitida?`,
      confirmLabel: "Sí, sáltala",
      now,
    });
  }

  const fecha = request.due_date.trim();
  if (!esFechaIso(fecha)) {
    return {
      kind: "needs_clarification",
      question: `¿Para qué día muevo la cuota ${cuota.number} de «${debt.name}»? Ahora vence el ${cuota.due_date}.`,
    };
  }

  return draft({
    operation: "reschedule_installment",
    catalogCommand: "reprogramar_cuota",
    payload: {
      debt_id: debt.id,
      installment_id: cuota.id,
      due_date: fecha,
      reason: request.reason.trim() || null,
    },
    summary: `${describeInstallmentRescheduleConsequence({
      installmentNumber: cuota.number,
      debtName: debt.name,
    })} Pasaría del ${cuota.due_date} al ${fecha}. ¿La muevo?`,
    confirmLabel: "Sí, muévela",
    now,
  });
}

/**
 * `RUL-DEUDAS-15` + leccion de `structure-intent`: **nombrar a alguien no es
 * pedir que se le dé de alta**. "vincula la caja Carro a la deuda de Marco"
 * nombra a Marco y no pide crearlo, y "pagué 200 a Marco" tampoco.
 *
 * Por eso aqui hay dos filtros deterministicos sobre la lectura del modelo: si
 * la persona ya existe no se propone crearla —se dice que ya está—, y si el
 * turno no trae un verbo de alta explicito tampoco, aunque el modelo lo crea.
 */
function compileCreatePerson(
  request: DebtActionRequest,
  relatedPeople: DebtActionPersonContext[],
  now: string,
): DebtActionCompilation {
  const nombre = request.person_name.trim();
  if (!nombre) {
    return {
      kind: "needs_clarification",
      question: "¿Cómo se llama la persona que quieres que agregue?",
    };
  }

  // `ERR-DEUDAS-08`: duplicar a alguien parte su historial en dos.
  const yaExiste = relatedPeople.find(
    (persona) =>
      normalizar(persona.display_name) === normalizar(nombre) ||
      persona.aliases.some((alias) => normalizar(alias) === normalizar(nombre)),
  );
  if (yaExiste) {
    return {
      kind: "needs_clarification",
      question: `Ya tienes a ${yaExiste.display_name} en tu lista, así que no lo agrego otra vez. ¿Querías registrar algo con esa persona?`,
    };
  }

  const relacion = request.person_relationship.trim();
  return draft({
    operation: "create_person",
    catalogCommand: "crear_persona",
    payload: {
      display_name: nombre,
      kind: "person",
      relationship_label: relacion || null,
    },
    summary: relacion
      ? `Agrego a ${nombre} (${relacion}) a tus personas. Solo guardo el nombre y la relación, y nunca sale del producto: no le escribo ni le aviso nada. ¿Lo agrego?`
      : `Agrego a ${nombre} a tus personas. Solo guardo el nombre, y nunca sale del producto: no le escribo ni le aviso nada. ¿Lo agrego?`,
    confirmLabel: "Sí, agrégalo",
    now,
  });
}

/**
 * Construye el borrador y lo **valida con el mismo esquema con el que se va a
 * leer al confirmarlo**. Si no valida aqui, el turno siguiente lo rechazaria
 * como `unknown_proposal` sin que nada explicara por que.
 */
function draft(input: {
  operation: DebtActionProposal["operation"];
  catalogCommand: string;
  payload: Record<string, unknown>;
  summary: string;
  confirmLabel: string;
  now: string;
}): DebtActionCompilation {
  const parsed = DebtActionProposalSchema.safeParse({
    proposal_id: randomUUID(),
    operation: input.operation,
    catalog_command: input.catalogCommand,
    payload: input.payload,
    summary: input.summary,
    confirm_label: input.confirmLabel,
    proposed_at: input.now,
  });

  if (!parsed.success) {
    return {
      kind: "unavailable",
      reason: `debt_action_draft_invalid:${input.catalogCommand}`,
    };
  }
  return { kind: "ready", command: parsed.data };
}

type DebtResolution =
  | { kind: "found"; debt: DebtActionDebtContext }
  | { kind: "unresolved"; question: string };

/**
 * Resuelve **cual** deuda, en este orden: el id exacto que dio el modelo (solo
 * si existe de verdad entre las del usuario), y si no, lo que el propio texto
 * de la persona nombra. Un id que no esta en la lista se descarta en vez de
 * confiarse: es la unica forma de que un identificador inventado no escriba.
 */
function resolveDebt(input: {
  request: DebtActionRequest;
  userText: string;
  debts: DebtActionDebtContext[];
}): DebtResolution {
  const { debts } = input;
  if (debts.length === 0) {
    return {
      kind: "unresolved",
      question:
        input.request.intent === "reabrir_deuda"
          ? "No veo ninguna deuda condonada que pueda reabrir. Solo puedo reabrir las que se dieron por perdonadas; una que quedó pagada no se reabre."
          : "No veo ninguna deuda activa tuya. ¿De cuál me hablas?",
    };
  }

  const porId = debts.find((debt) => debt.id === input.request.debt_id.trim());
  if (porId) return { kind: "found", debt: porId };

  const texto = normalizar(input.userText);
  const candidatos = debts.filter((debt) => mencionada(debt, texto));

  if (candidatos.length === 1) return { kind: "found", debt: candidatos[0] };

  if (candidatos.length === 0) {
    // Una sola deuda viva y un turno que habla de deudas: no hay nada que
    // desambiguar. Con mas de una, preguntar es mas barato que acertar.
    if (debts.length === 1) return { kind: "found", debt: debts[0] };
    return {
      kind: "unresolved",
      question: `¿Cuál de tus deudas? Tienes ${enumerar(
        debts.slice(0, 5).map((debt) => `«${debt.name}»`),
      )}.`,
    };
  }

  return {
    kind: "unresolved",
    question: `Puede ser más de una: ${enumerar(
      candidatos.slice(0, 5).map((debt) => `«${debt.name}»`),
    )}. ¿Cuál?`,
  };
}

function mencionada(debt: DebtActionDebtContext, texto: string): boolean {
  const terminos = [
    debt.name,
    debt.related_person_name ?? "",
    ...debt.related_person_aliases,
  ]
    .map(normalizar)
    .filter((termino) => termino.length >= 3);
  return terminos.some((termino) => texto.includes(termino));
}

function resolveInstallment(
  request: DebtActionRequest,
  debt: DebtActionDebtContext,
): DebtActionDebtContext["installments"][number] | null {
  const abiertas = abiertasDe(debt);
  const porId = abiertas.find(
    (cuota) => cuota.id === request.installment_id.trim(),
  );
  if (porId) return porId;
  // Con una sola cuota abierta no hay ambigüedad posible.
  return abiertas.length === 1 ? abiertas[0] : null;
}

function abiertasDe(
  debt: DebtActionDebtContext,
): DebtActionDebtContext["installments"] {
  return debt.installments
    .filter((cuota) => ["pending", "due_soon", "overdue"].includes(cuota.status))
    .sort((izquierda, derecha) =>
      izquierda.due_date === derecha.due_date
        ? izquierda.number - derecha.number
        : izquierda.due_date.localeCompare(derecha.due_date),
    );
}

/** Texto de la via manual de un comando que este motor no ejecuta. */
export function describeUnavailableDebtAction(reason: string): string | null {
  const entrada = Object.values(NO_DISPONIBLES).find(
    (item) => item.reason === reason,
  );
  return entrada?.text ?? null;
}

function preguntaPorFaltaDeDatos(intent: DebtActionIntent): string {
  if (intent === "cerrar_deuda") {
    return "¿Cuál deuda quieres cerrar? Antes de tocarla te digo cuánto queda y si sería como pagada o como perdonada.";
  }
  if (intent === "reabrir_deuda") return "¿Cuál deuda quieres reabrir?";
  if (intent === "saltar_cuota") {
    return "¿Cuál cuota quieres saltar, y por qué? Saltarla no reduce lo que debes.";
  }
  if (intent === "reprogramar_cuota") {
    return "¿Cuál cuota quieres mover, y para qué día?";
  }
  return "¿A quién quieres que agregue a tus personas?";
}

function esFechaIso(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instante = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(instante.getTime()) &&
    instante.toISOString().slice(0, 10) === value
  );
}

function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function redondear(value: number): number {
  return Math.round(value * 100) / 100;
}
