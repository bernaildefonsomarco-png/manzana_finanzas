// Extraccion de identificadores del corpus: que se define donde, y quien cita
// a quien.
//
// El sistema de identificadores lo fija `01` §3 y el registro de tokens
// `50` §2. Aqui solo se lee.

import type { Documento } from "./corpus.ts";
import type { RegistroDeTokens } from "./registro-tokens.ts";

export const FAMILIAS = ["MOD", "SCR", "ACT", "RUL", "ERR", "AC"] as const;
export type Familia = (typeof FAMILIAS)[number];

export interface Aparicion {
  id?: string;
  familia: Familia;
  token: string;
  numero: string;
  texto: string;
  marcador?: boolean;
  malformado?: boolean;
  documento: string;
  numeroDocumento: string;
  seccion: string;
  linea: number;
  textoLinea: string;
  enCerca: boolean;
  tokenRegistrado: boolean;
  candidataADefinicion: boolean;
  indiceForma: number;
  definicion: boolean;
}

export interface EntradaIdentificador {
  id: string;
  familia: Familia;
  token: string;
  definiciones: Aparicion[];
  citas: Aparicion[];
}

/**
 * Marcadores de sintaxis, no identificadores.
 *
 * `AC-XXX-NN` en `49` §6 y `55` §4 ilustra la forma de un criterio; no nombra
 * ninguno. `RUL-TRAZ-04` exige que los ejemplos usen identificadores reales, y
 * por eso un marcador solo se tolera dentro de un bloque cercado — donde se
 * esta mostrando la sintaxis, no citando nada. El test de `AC-TRAZ-03` lo
 * comprueba.
 */
const TOKENS_MARCADOR = new Set(["XXX", "YYY"]);
const NUMEROS_MARCADOR = new Set(["NN", "MM"]);

const FUENTE_PATRON = "\\b(MOD|SCR|ACT|RUL|ERR|AC)-([A-Z][A-Z0-9]*)(?:-([A-Z0-9]+))?\\b";

/** Instancia propia por recorrido: `lastIndex` es estado y no se comparte. */
function nuevoPatron(): RegExp {
  return new RegExp(FUENTE_PATRON, "g");
}

interface Clasificada {
  id?: string;
  familia: Familia;
  token: string;
  numero: string;
  texto: string;
  marcador?: boolean;
  malformado?: boolean;
}

/**
 * Clasifica una coincidencia del patron.
 *
 * Devuelve `null` para lo que no es un identificador: la referencia a una
 * familia entera (`los AC-SEG-` de la prosa) y los marcadores de sintaxis.
 */
function clasificar(coincidencia: RegExpExecArray): Clasificada | null {
  const [texto, familiaTexto, token, numero] = coincidencia;
  const familia = familiaTexto as Familia;

  if (familia === "MOD") {
    // `MOD-` usa el nombre largo y no lleva numero (`50` §2.1).
    if (numero !== undefined) return null;
    return { id: `MOD-${token}`, familia, token, numero: "", texto };
  }

  if (numero === undefined) {
    // `RUL-TRAZ-` sin numero es una referencia a la familia, no un ID.
    return null;
  }

  const esMarcador = TOKENS_MARCADOR.has(token) || NUMEROS_MARCADOR.has(numero);
  if (esMarcador) {
    return { marcador: true, texto, familia, token, numero };
  }

  if (!/^\d+$/.test(numero)) {
    // `AC-SEG-01a` o similares. No existen hoy; si aparecen, que se vean.
    return { malformado: true, texto, familia, token, numero };
  }

  return { id: `${familia}-${token}-${numero}`, familia, token, numero, texto };
}

/**
 * ¿Que forma tiene el principio de esta linea, si es que define algo?
 *
 * Medido sobre las 59 documentos: `ACT-` y `ERR-` se definen siempre en la
 * primera celda de una fila de tabla; `RUL-` siempre en negrita; `AC-` siempre
 * en item de lista; `MOD-` siempre en el campo `**ID de módulo:**`.
 *
 *   ### `SCR-MOV-01` — Listado           SCR: encabezado
 *   **`RUL-MOV-01`** — Los 11 tipos      RUL: negrita al principio de linea
 *   - `AC-MOV-01` — Los 11 tipos se…     AC: item de lista
 *   | `ACT-MOV-01` | Crear movimiento |  ACT y ERR: primera celda de tabla
 *   **ID de módulo:** `MOD-MOVIMIENTOS`  MOD: encabezado de documento
 *
 * `SCR-` es la unica familia con dos formas legitimas, y por eso con
 * **prioridad** entre ellas en vez de una sola marca booleana. La plantilla
 * de modulo (`01` §8 item 8) define cada superficie con un encabezado propio,
 * pero los seis documentos sin plantilla obligatoria (`41`, `43`–`46`, `48`)
 * a veces declaran una superficie menor solo en su tabla resumen, sin
 * encabezado dedicado — es legitimo, no tienen la plantilla de los 22
 * secciones. Cuando **ambas** formas existen para el mismo ID en el mismo
 * documento (`31` `SCR-DEUDAS-01`: fila de resumen en §8 seguida de su propio
 * encabezado), el encabezado es la definicion real y la fila de resumen es
 * cita — por eso el encabezado tiene prioridad, no por ser el primero en
 * aparecer.
 *
 * Sin esta prioridad, una tabla de referencia cruzada como la de §12 en `27`
 * (`| SCR-PEND-01 | Sí — PENDING_FUNCTIONAL … |`, sobre que estados de datos
 * tiene cada pantalla) se leeria como una segunda definicion: tiene forma de
 * fila de tabla y el documento es el dueño del token, pero no define nada.
 */
const FORMAS_POR_FAMILIA: Record<Familia, RegExp[]> = {
  MOD: [/^\*\*ID de m[oó]dulo:\*\*\s*`?$/],
  SCR: [/^#{2,6}\s+`?$/, /^\|\s*`?$/],
  RUL: [/^\s*\*\*`?$/],
  ACT: [/^\|\s*`?$/],
  ERR: [/^\|\s*`?$/],
  AC: [/^\s*[-*]\s+`?$/],
};

/** Indice de la primera forma que coincide, o `-1` si ninguna. */
function indiceDeForma(linea: string, indiceInicio: number, familia: Familia): number {
  const anterior = linea.slice(0, indiceInicio);

  // Solo puede definir el primer identificador de la linea.
  const primera = nuevoPatron().exec(linea);
  if (!primera || primera.index !== indiceInicio) return -1;

  const formas = FORMAS_POR_FAMILIA[familia] ?? [];
  return formas.findIndex((forma) => forma.test(anterior));
}

/**
 * Recorre el corpus y devuelve todas las apariciones de identificadores.
 *
 * Cada aparicion sabe si es definicion o cita, en que documento y seccion cae,
 * y si estaba dentro de un bloque cercado. La resolucion es en dos pasadas:
 * primero se recogen todas las candidatas con forma valida (§ arriba), luego,
 * por cada `(documento, id)`, gana la de mayor prioridad de forma y, en
 * empate, la primera en orden de lectura. El resto queda como cita.
 */
export function extraerApariciones(documentos: Documento[], registro: RegistroDeTokens): Aparicion[] {
  const apariciones: Aparicion[] = [];
  const dueñoDelToken = (clasificada: Clasificada): string | undefined =>
    clasificada.familia === "MOD"
      ? registro.porNombreLargo.get(clasificada.id ?? "")
      : registro.porToken.get(clasificada.token);

  for (const documento of documentos) {
    documento.lineas.forEach((linea, indice) => {
      const patron = nuevoPatron();
      let coincidencia: RegExpExecArray | null;
      while ((coincidencia = patron.exec(linea)) !== null) {
        const clasificada = clasificar(coincidencia);
        if (!clasificada) continue;

        const esMarcadorOMalformado = Boolean(clasificada.marcador) || Boolean(clasificada.malformado);
        const esDelDueño = dueñoDelToken(clasificada) === documento.numero;
        const indiceForma = documento.dentroDeCerca[indice]
          ? -1
          : esMarcadorOMalformado
            ? -1
            : indiceDeForma(linea, coincidencia.index, clasificada.familia);

        apariciones.push({
          ...clasificada,
          documento: documento.ruta,
          numeroDocumento: documento.numero,
          seccion: documento.secciones[indice],
          linea: indice + 1,
          textoLinea: linea,
          enCerca: documento.dentroDeCerca[indice],
          tokenRegistrado: dueñoDelToken(clasificada) !== undefined,
          candidataADefinicion: esDelDueño && indiceForma >= 0,
          indiceForma,
          definicion: false, // se decide abajo, tras ver todas las candidatas
        });
      }
    });
  }

  resolverDefiniciones(apariciones);
  return apariciones;
}

/** Marca `definicion: true` en la candidata ganadora de cada (documento, id). */
function resolverDefiniciones(apariciones: Aparicion[]): void {
  const grupos = new Map<string, Aparicion[]>();
  for (const aparicion of apariciones) {
    if (!aparicion.id || !aparicion.candidataADefinicion) continue;
    const clave = `${aparicion.documento} ${aparicion.id}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(aparicion);
  }

  for (const candidatas of grupos.values()) {
    const ganadora = candidatas.reduce((mejor, actual) =>
      actual.indiceForma < mejor.indiceForma ||
      (actual.indiceForma === mejor.indiceForma && actual.linea < mejor.linea)
        ? actual
        : mejor
    );
    ganadora.definicion = true;
  }
}

/**
 * Agrupa las apariciones por identificador.
 *
 * Un identificador con mas de una definicion es el defecto que `AC-HECHO-01`
 * persigue; uno con cero es el que persigue `AC-TRAZ-03`.
 */
export function agruparPorIdentificador(apariciones: Aparicion[]): Map<string, EntradaIdentificador> {
  const porId = new Map<string, EntradaIdentificador>();

  for (const aparicion of apariciones) {
    if (!aparicion.id) continue;
    if (!porId.has(aparicion.id)) {
      porId.set(aparicion.id, {
        id: aparicion.id,
        familia: aparicion.familia,
        token: aparicion.token,
        definiciones: [],
        citas: [],
      });
    }
    const entrada = porId.get(aparicion.id)!;
    if (aparicion.definicion) {
      entrada.definiciones.push(aparicion);
    } else {
      entrada.citas.push(aparicion);
    }
  }

  return porId;
}
