import { CATEGORY_LABELS } from "@/shared/copy/category-copy";
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
    }
  /**
   * `ERR-ASI-01`: la persona pidio crear o cambiar una **categoria**, y eso el
   * motor no lo hace ni lo hara. Es una lectura propia y no un `none` porque
   * las dos terminan distinto: `none` deja seguir el turno en silencio —que es
   * exactamente el fallo que este modulo existe para cerrar— y esta obliga a
   * decirlo con todas las letras y a ofrecer la subcategoria, que si se puede.
   */
  | { kind: "unsupported"; reason: "category_is_fixed"; evidence: string[] };

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

/**
 * Senales de compromiso que se repite en el tiempo: eso es un pago recurrente,
 * y como un presupuesto, tampoco aparta dinero (`RUL-REC-01`).
 *
 * Se dejan fuera a proposito las expresiones de periodicidad a secas ("cada
 * mes", "todos los meses"): un presupuesto tambien es mensual, asi que
 * contarlas como senal volveria ambigua —y por tanto repreguntable— la frase
 * mas normal para crear un presupuesto.
 */
const SENALES_DE_RECURRENTE = [
  "recurrente",
  "suscripcion",
  "mensualidad",
  "pago fijo",
  "pago que viene",
  "pagos que vienen",
  "me cobran",
  "se cobra",
  "cobro automatico",
  "debito automatico",
  "domiciliado",
];

/**
 * Senales de cuenta: donde vive el dinero. Es la palabra mas ambigua de las
 * cinco —"de que cuenta sale", "en mi cuenta BCP"— y por eso depende por
 * completo de `esObjetivo`: solo cuenta cuando no viene detras de una
 * preposicion de referencia.
 */
const SENALES_DE_CUENTA = [
  "cuenta",
  "cuenta bancaria",
  "billetera",
  "banco nuevo",
];

/**
 * Senales de subcategoria: la etiqueta propia que cuelga de una de las 12
 * categorias. La palabra es larga y sin sinonimos reales, asi que a diferencia
 * de "cuenta" no compite con nada.
 *
 * "categoria" **no** esta en esta lista y no es un descuido: pedir una
 * categoria nueva no es pedir una subcategoria, es pedir algo que no existe, y
 * se lee aparte en `SENALES_DE_CATEGORIA`.
 */
const SENALES_DE_SUBCATEGORIA = [
  "subcategoria",
  "sub categoria",
  "subrubro",
];

/**
 * La palabra "categoria" a secas. Solo sirve para poder **negar** con nombre
 * propio (`ERR-ASI-01`), igual que `forget_all` en `memory_control`.
 */
const PATRON_DE_CATEGORIA = "(?:categorias?|rubros?)";

/**
 * Verbos con los que se pide **algo que no habia**. Es un subconjunto estrecho
 * de `SENALES_DE_ESCRITURA` a proposito: "cambia la categoria de ese gasto"
 * tambien es una escritura, pero es una correccion de un movimiento y su
 * camino es `correction_proposal`. Contestar ahi que las categorias son fijas
 * seria negar algo que el motor si hace.
 */
const SENALES_DE_CREACION = [
  "crea",
  "crear",
  "creame",
  "cree",
  "creo",
  "arma",
  "armar",
  "abre",
  "abrir",
  "agrega",
  "agregar",
  "anade",
  "anadir",
  "haz",
  "hacer",
  "inventa",
  "inventar",
  "quiero",
  "necesito",
  "pon",
  "poner",
  "ponme",
];

/**
 * "categoria" precedida o seguida de un determinante que la vuelve algo que
 * todavia no existe. Es la linea que separa el pedido imposible de los
 * normales: "una categoria nueva" pide una que no hay, mientras que "la
 * categoria de ese gasto" o "en la categoria comida" apuntan a una de las 12
 * que ya estan.
 *
 * Los dos `\b` son los que dejan fuera a la subcategoria, que si se puede
 * crear: dentro de "subcategoria" no hay limite de palabra antes de
 * "categoria", porque la "b" que la precede tambien es caracter de palabra.
 * Sin ellos, la frase que si se puede atender —"ponlo en una subcategoria
 * nueva"— acabaria contestando que no se puede.
 */
const CATEGORIA_QUE_NO_EXISTE = new RegExp(
  `\\b(?:una|otra|nueva|nuevas)\\s+(?:nueva\\s+)?${PATRON_DE_CATEGORIA}\\b` +
    `|\\b${PATRON_DE_CATEGORIA}\\s+(?:nueva|nuevas)\\b`,
);

/**
 * Devuelve la evidencia de que la persona pidio una categoria **nueva**, o
 * `null` si no lo pidio. Exige las dos mitades —un verbo de creacion y un
 * determinante que la haga inexistente— porque cada una por su cuenta produce
 * falsos positivos caros: el verbo solo confunde "agrega este gasto a la
 * categoria comida", y el determinante solo confunde "cual es una categoria
 * que uso poco".
 */
function leerCategoriaNueva(texto: string): string[] | null {
  const pideCrear = SENALES_DE_CREACION.some((senal) => contiene(texto, senal));
  if (!pideCrear) return null;

  const match = CATEGORIA_QUE_NO_EXISTE.exec(texto);
  return match ? [match[0]] : null;
}

/**
 * `ERR-ASI-01`: la respuesta al pedido que el motor no puede atender. Dice el
 * limite, lo enumera —para que no haya que adivinar cuales son las 12— y
 * ofrece lo unico que si se puede hacer, que ademas suele ser lo que la
 * persona queria de verdad.
 *
 * El texto no lo redacta el modelo, por la misma razon que en `RUL-ESTR-05`:
 * un "no puedo" que el modelo suaviza o adorna deja a la persona creyendo que
 * quizas si.
 */
export function composeCategoryIsFixedAnswer(): string {
  const nombres = Object.values(CATEGORY_LABELS);
  const enumeradas = `${nombres.slice(0, -1).join(", ")} y ${nombres[nombres.length - 1]}`;
  return (
    "No puedo crear categorías: son 12 fijas y no se añaden ni se quitan. " +
    `Las que hay son ${enumeradas}. ` +
    "Lo que sí puedo crear es una subcategoría tuya dentro de una de ellas. " +
    "Dime cómo la llamamos y dentro de cuál va, y te la preparo."
  );
}

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
  // Ciclo de vida: cerrar, pausar y reanudar tambien son escrituras, y las
  // primeras son destructivas (`RUL-ESTR-05`).
  "archiva",
  "archivar",
  "cierra",
  "cerrar",
  "elimina",
  "eliminar",
  "borra",
  "borrar",
  "cancela",
  "cancelar",
  "da de baja",
  "dar de baja",
  "quita",
  "quitar",
  "pausa",
  "pausar",
  "congela",
  "congelar",
  "detener",
  "reanuda",
  "reanudar",
  "retoma",
  "retomar",
  "activa",
  "activar",
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

  const evidenciaPorEntidad: Array<{
    entity: StructureEntity;
    evidencia: string[];
  }> = [
    { entity: "caja", evidencia: coincidencias(normalizado, SENALES_DE_CAJA) },
    { entity: "meta", evidencia: coincidencias(normalizado, SENALES_DE_META) },
    {
      entity: "presupuesto",
      evidencia: coincidencias(normalizado, SENALES_DE_PRESUPUESTO),
    },
    {
      entity: "recurrente",
      evidencia: coincidencias(normalizado, SENALES_DE_RECURRENTE),
    },
    {
      entity: "cuenta",
      evidencia: coincidencias(normalizado, SENALES_DE_CUENTA),
    },
    {
      entity: "subcategoria",
      evidencia: coincidencias(normalizado, SENALES_DE_SUBCATEGORIA),
    },
  ];

  // Nombrar una entidad no es pedirla: en "crea una caja para esa meta" la
  // caja es lo que se crea y la meta es a lo que apunta. Antes bastaba con
  // que las dos palabras aparecieran para declarar ambigüedad, asi que la
  // frase mas natural para vincular una caja a una meta preguntaba en vez de
  // hacer, y repreguntaba igual porque la respuesta volvia a nombrar las dos.
  //
  // La misma regla es la que sostiene a "cuenta": "crea una caja en mi cuenta
  // BCP" habla de una caja, y la cuenta solo dice donde.
  const candidatos = evidenciaPorEntidad
    .filter((item) => esObjetivo(normalizado, item.evidencia))
    .map((item) => item.entity);

  // `ERR-ASI-01`: pedir una **categoria** nueva se lee antes que nada, porque
  // es lo unico de este modulo que termina en un "no". Se lee solo cuando la
  // frase no habla ya de una subcategoria: "crea una subcategoria dentro de la
  // categoria Vivienda" nombra las dos y pide la que si existe.
  const categoriaNueva = candidatos.includes("subcategoria")
    ? null
    : leerCategoriaNueva(normalizado);
  if (categoriaNueva) {
    return {
      kind: "unsupported",
      reason: "category_is_fixed",
      evidence: categoriaNueva,
    };
  }

  if (candidatos.length === 0) {
    // Sin ninguna senal de dominio no hay nada que clasificar aqui, aunque el
    // mensaje traiga un verbo de escritura: puede estar hablando de un gasto.
    return { kind: "none" };
  }

  const evidencia = evidenciaPorEntidad.flatMap((item) => item.evidencia);

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
  // Un pedido de categoria nueva no lo resuelve este guardarrail: lo contesta
  // el compilador con el "no puedo" y su alternativa, antes de llegar aqui.
  if (reading.kind === "unsupported") return false;
  if (reading.kind === "ambiguous") {
    // Ambigua: la propuesta no puede resolverla por su cuenta.
    return true;
  }
  return reading.entity !== proposedEntity;
}

/**
 * Que hace cada entidad, en una linea. Es lo que separa las dos confusiones
 * caras: creer que se aparto dinero cuando no, y creer que no cuando si.
 */
const QUE_ES_CADA_UNA: Record<StructureEntity, string> = {
  caja: "una caja aparta dinero de verdad y deja de estar disponible",
  meta: "una meta es un objetivo con monto y fecha para ir siguiéndolo",
  presupuesto: "un presupuesto solo es una referencia de gasto y no toca tu saldo",
  recurrente: "un pago recurrente es algo que esperas pagar cada cierto tiempo, y tampoco aparta nada",
  cuenta: "una cuenta es dónde vive tu dinero",
  subcategoria: "una subcategoría es una etiqueta tuya dentro de una de las 12 categorías, y no toca ningún saldo",
};

/** Pregunta que se le hace al usuario cuando la lectura no es unica. */
export function composeStructureAmbiguityQuestion(
  candidates: StructureEntity[],
): string {
  const unicos = [...new Set(candidates)];
  const tieneCaja = unicos.includes("caja");
  const tienePresupuesto = unicos.includes("presupuesto");
  const tieneMeta = unicos.includes("meta");

  if (unicos.length === 2) {
    if (tieneCaja && tienePresupuesto) {
      return "Antes de crear nada: ¿quieres apartar ese dinero de verdad (una caja, deja de estar disponible) o solo ponerte una referencia de cuánto gastar (un presupuesto, no toca tu saldo)?";
    }

    if (tieneCaja && tieneMeta) {
      return "¿Quieres apartar el dinero ya (una caja) o registrar el objetivo con su fecha para ir siguiéndolo (una meta)?";
    }

    if (tienePresupuesto && tieneMeta) {
      return "¿Es un límite de gasto para el periodo (un presupuesto) o un objetivo de ahorro con fecha (una meta)?";
    }
  }

  if (unicos.length === 0) {
    return "¿Te refieres a una caja, a una meta o a un presupuesto? Una caja aparta dinero, un presupuesto solo es una referencia y una meta es un objetivo con fecha.";
  }

  // Cualquier otra combinacion se explica enumerando: preguntar de mas es mas
  // barato que escribir la entidad equivocada (`RUL-PRES-01`).
  const explicaciones = unicos.map((entity) => QUE_ES_CADA_UNA[entity]);
  return `¿Te refieres a ${enumerar(unicos.map((entity) => articuloIndefinido(entity)))}? Recuerda que ${enumerar(explicaciones)}.`;
}

function articuloIndefinido(entity: StructureEntity): string {
  if (entity === "presupuesto") return "un presupuesto";
  if (entity === "recurrente") return "un pago recurrente";
  if (entity === "cuenta") return "una cuenta";
  if (entity === "subcategoria") return "una subcategoría";
  return entity === "caja" ? "una caja" : "una meta";
}

function enumerar(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  return `${items.slice(0, -1).join(", ")} o ${items[items.length - 1]}`;
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

/**
 * Preposiciones que introducen un complemento: lo que viene detras es aquello
 * a lo que la frase apunta, no lo que pide crear. "una caja para esa meta"
 * habla de una caja; la meta solo dice para que.
 */
const PREPOSICIONES_DE_REFERENCIA = new Set([
  "para",
  "de",
  "del",
  "hacia",
  "sobre",
  "asociada",
  "asociado",
  "vinculada",
  "vinculado",
  "junto",
  // `en` y `con` entran con las cuentas: "crea una caja en mi cuenta BCP"
  // habla de una caja, y sin ellas la palabra `cuenta` —la mas comun de las
  // cinco— volveria ambigua la frase mas natural para crear una caja.
  // `a` queda fuera a proposito: "voy a crear una caja" la dejaria sin
  // candidato ninguno.
  "en",
  "con",
  "desde",
]);

/**
 * Cuantas palabras se miran hacia atras buscando la preposicion. Tres cubren
 * el determinante y algun relleno ("para la meta", "para mi meta del carro")
 * sin llegar tan lejos como para capturar una preposicion de otra clausula.
 *
 * Se mira una ventana en vez de detenerse en la primera palabra desconocida
 * porque la gente escribe rapido: "para es meta" —sin la "a"— es la frase real
 * que hizo fallar la primera version de esta lectura.
 */
const VENTANA_DE_REFERENCIA = 3;

/**
 * Una señal es el objetivo del turno si aparece al menos una vez SIN una
 * preposicion de referencia cerca por delante. Si todas sus apariciones son
 * complementos, la entidad se menciona pero no se pide.
 *
 * Las señales de varias palabras ("no gastar mas de") son locuciones que ya
 * expresan la intencion completa, asi que nunca se leen como complemento.
 */
function esObjetivo(texto: string, senales: string[]): boolean {
  if (senales.length === 0) return false;

  const palabras = texto.split(" ");

  return senales.some((senal) => {
    if (senal.includes(" ")) return true;

    const patron = new RegExp(`^${senal}${SUFIJOS_TOLERADOS}$`);
    return palabras.some((palabra, indice) => {
      if (!patron.test(palabra)) return false;

      const desde = Math.max(0, indice - VENTANA_DE_REFERENCIA);
      const previas = palabras.slice(desde, indice);
      return !previas.some((anterior) =>
        PREPOSICIONES_DE_REFERENCIA.has(anterior),
      );
    });
  });
}
