import type { StructureEntity } from "./structure-commands";

/**
 * `RUL-PRES-01` (`RUL-ESTR-02`): un presupuesto es una **referencia** de gasto
 * y nunca aparta ni bloquea dinero. Una caja si aparta saldo real dentro de
 * una cuenta. Una meta es un objetivo con monto y fecha que se apoya en una
 * caja.
 *
 * Confundirlas es caro en las dos direcciones: crear un presupuesto cuando el
 * usuario queria apartar plata le deja el dinero disponible para gastarlo, y
 * crear una caja cuando queria un limite le inmoviliza saldo que necesitaba.
 * Por eso esta lectura no adivina: cuando el mensaje admite mas de una lectura
 * razonable, devuelve `ambiguous` y el turno **pregunta** en vez de escribir.
 *
 * Esto no reemplaza al modelo: es el guardarrail deterministico que corre
 * **sobre** su propuesta. El modelo elige la entidad; esta lectura veta la
 * eleccion que contradice lo que el usuario dijo.
 */

export type StructureIntentReading =
  /** El texto no habla de crear ni modificar estructura. */
  | { kind: "none" }
  /** Una sola lectura razonable. */
  | { kind: "unambiguous"; entity: StructureEntity; evidence: string[] }
  /** Mas de una lectura razonable: hay que preguntar antes de escribir. */
  | {
      kind: "ambiguous";
      candidates: StructureEntity[];
      evidence: string[];
    };

/** Verbos que significan apartar dinero de verdad: eso es una caja. */
const SENALES_DE_CAJA = [
  "aparta",
  "apartar",
  "aparto",
  "separa",
  "separar",
  "separo",
  "reserva",
  "reservar",
  "reservo",
  "guarda",
  "guardar",
  "guardo",
  "caja",
  "cajita",
  "alcancia",
  "no lo toque",
  "no tocarlo",
  "intocable",
];

/** Senales de referencia de gasto: eso es un presupuesto, y no toca el saldo. */
const SENALES_DE_PRESUPUESTO = [
  "presupuesto",
  "presupuestar",
  "limite",
  "tope",
  "no gastar mas de",
  "no pasarme de",
  "no gastar mas que",
  "maximo al mes",
  "maximo por mes",
  "maximo por semana",
  "cuanto puedo gastar",
];

/** Senales de objetivo con monto y horizonte: eso es una meta. */
const SENALES_DE_META = [
  "meta",
  "objetivo",
  "juntar",
  "quiero llegar a",
  "llegar a tener",
  "ahorrar para",
  "ahorro para",
];

/** Verbos de escritura: sin uno de estos, el turno no pide crear nada. */
const SENALES_DE_ESCRITURA = [
  "crea",
  "crear",
  "creame",
  "cree",
  "arma",
  "armar",
  "abre",
  "abrir",
  "agrega",
  "agregar",
  "anade",
  "anadir",
  "pon",
  "poner",
  "ponme",
  "sube",
  "subir",
  "baja",
  "bajar",
  "cambia",
  "cambiar",
  "edita",
  "editar",
  "modifica",
  "modificar",
  "renombra",
  "renombrar",
  "actualiza",
  "actualizar",
  "quiero",
  "necesito",
  "aparta",
  "apartar",
  "separa",
  "separar",
  "reserva",
  "reservar",
  "guarda",
  "guardar",
  "presupuestar",
];

/**
 * Lee el mensaje del usuario y dice de que entidad de estructura habla, o si
 * admite mas de una lectura. No decide la operacion (crear/modificar): eso lo
 * resuelve el modelo con el contexto del turno.
 */
export function readStructureIntent(text: string): StructureIntentReading {
  const normalizado = normalizar(text);
  if (!normalizado) return { kind: "none" };

  const pideEscribir = SENALES_DE_ESCRITURA.some((senal) =>
    contiene(normalizado, senal),
  );

  const evidenciaCaja = coincidencias(normalizado, SENALES_DE_CAJA);
  const evidenciaPresupuesto = coincidencias(
    normalizado,
    SENALES_DE_PRESUPUESTO,
  );
  const evidenciaMeta = coincidencias(normalizado, SENALES_DE_META);

  const candidatos: StructureEntity[] = [];
  if (evidenciaCaja.length > 0) candidatos.push("caja");
  if (evidenciaMeta.length > 0) candidatos.push("meta");
  if (evidenciaPresupuesto.length > 0) candidatos.push("presupuesto");

  if (candidatos.length === 0) {
    // Sin ninguna senal de dominio no hay nada que clasificar aqui, aunque el
    // mensaje traiga un verbo de escritura: puede estar hablando de un gasto.
    return { kind: "none" };
  }

  const evidencia = [
    ...evidenciaCaja,
    ...evidenciaMeta,
    ...evidenciaPresupuesto,
  ];

  if (!pideEscribir) {
    // Nombra la entidad pero no pide escribir: probablemente esta preguntando.
    return { kind: "none" };
  }

  if (candidatos.length === 1) {
    return { kind: "unambiguous", entity: candidatos[0], evidence: evidencia };
  }

  return { kind: "ambiguous", candidates: candidatos, evidence: evidencia };
}

/**
 * Guardarrail sobre la propuesta del modelo. Devuelve la entidad que el turno
 * puede escribir, o `null` cuando la propuesta contradice lo que el usuario
 * dijo y por tanto hay que preguntar en lugar de ejecutar.
 *
 * Un caso concreto que este guardarrail existe para atajar: "apartame 500 para
 * el viaje" con una propuesta de presupuesto. Un presupuesto no aparta nada
 * (`RUL-PRES-01`), asi que ejecutarlo dejaria al usuario creyendo que separo
 * dinero que en realidad sigue disponible.
 */
export function structureProposalConflictsWithIntent(params: {
  proposedEntity: StructureEntity;
  reading: StructureIntentReading;
}): boolean {
  const { reading, proposedEntity } = params;
  if (reading.kind === "none") return false;
  if (reading.kind === "ambiguous") {
    // Ambigua: la propuesta no puede resolverla por su cuenta.
    return true;
  }
  return reading.entity !== proposedEntity;
}

/** Pregunta que se le hace al usuario cuando la lectura no es unica. */
export function composeStructureAmbiguityQuestion(
  candidates: StructureEntity[],
): string {
  const tieneCaja = candidates.includes("caja");
  const tienePresupuesto = candidates.includes("presupuesto");
  const tieneMeta = candidates.includes("meta");

  if (tieneCaja && tienePresupuesto) {
    return "Antes de crear nada: ¿quieres apartar ese dinero de verdad (una caja, deja de estar disponible) o solo ponerte una referencia de cuánto gastar (un presupuesto, no toca tu saldo)?";
  }

  if (tieneCaja && tieneMeta) {
    return "¿Quieres apartar el dinero ya (una caja) o registrar el objetivo con su fecha para ir siguiéndolo (una meta)?";
  }

  if (tienePresupuesto && tieneMeta) {
    return "¿Es un límite de gasto para el periodo (un presupuesto) o un objetivo de ahorro con fecha (una meta)?";
  }

  return "¿Te refieres a una caja, a una meta o a un presupuesto? Una caja aparta dinero, un presupuesto solo es una referencia y una meta es un objetivo con fecha.";
}

function normalizar(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * El espanol pega los cliticos al verbo ("apartame", "guardamelo") y pluraliza
 * los sustantivos ("cajas", "topes"). Sin esta tolerancia, "apartame 500 para
 * el viaje" —la frase textual del caso que este modulo existe para atajar— no
 * coincidiria con ninguna senal.
 */
const SUFIJOS_TOLERADOS = "(s|es|me|te|nos|lo|la|los|las|melo|mela|selo|sela)?";

function contiene(texto: string, senal: string): boolean {
  if (senal.includes(" ")) return texto.includes(senal);
  return new RegExp(`\\b${senal}${SUFIJOS_TOLERADOS}\\b`).test(texto);
}

function coincidencias(texto: string, senales: string[]): string[] {
  return senales.filter((senal) => contiene(texto, senal));
}
