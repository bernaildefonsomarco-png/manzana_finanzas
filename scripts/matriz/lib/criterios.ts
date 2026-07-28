// Parseo de la sintaxis de un criterio de aceptación (`49` §6):
//
//   - `AC-XXX-NN` — Enunciado verificable. Evidencia: `TEST`. Clase: `unidad`.
//
// `Evidencia:` es obligatoria siempre; `Clase:` es obligatoria si y solo si el
// nivel incluye `TEST` (`RUL-HECHO-03`). Este modulo solo lee: la asignacion
// de clase a las 545 pendientes es del `51`, no de este generador.

import type { Documento } from "./corpus.ts";

export const NIVELES = ["DOC", "CODE", "TEST", "SMOKE", "LIVE", "USER", "METRIC"] as const;
export type Nivel = (typeof NIVELES)[number];

export const CLASES = [
  "unidad",
  "integracion",
  "e2e",
  "lint",
  "build",
  "presupuesto",
  "contenido",
  "corpus",
] as const;
export type Clase = (typeof CLASES)[number];

export type Porton = "G1" | "G2" | "G3";

export interface EvidenciaDeCriterio {
  id: string;
  documento: string;
  linea: number;
  niveles: Nivel[];
  nivelesInvalidos: string[];
  clase: string | null;
  claseValida: boolean;
  exigeTest: boolean;
  /** `AC-HECHO-03`: clase obligatoria si y solo si el nivel incluye `TEST`. */
  formaValida: boolean;
  porton: Porton | null;
}

/**
 * El portón de un criterio es **exclusivo**, no la union de niveles.
 *
 * `49` §2.1 cuenta 558+11+139=708: un criterio `TEST` + `USER` (frecuente en
 * los módulos, ej. `AC-MOV-01`) cuenta una vez, en `G3` — que es el más
 * exigente de los que declara, no cada uno de ellos. La union sin exclusividad
 * da 680+11+139, que no cuadra con ningun total del corpus.
 */
function portonExclusivo(niveles: Nivel[]): Porton | null {
  if (niveles.includes("USER") || niveles.includes("METRIC")) return "G3";
  if (niveles.includes("SMOKE") || niveles.includes("LIVE")) return "G2";
  if (niveles.length > 0) return "G1";
  return null;
}

const PATRON_EVIDENCIA = /Evidencia:\s*((?:`[A-Z]+`(?:\s*\+\s*`[A-Z]+`)*))/;
const PATRON_CLASE = /Clase:\s*`([a-z0-9é]+)`/;

const SIN_EVIDENCIA: Omit<EvidenciaDeCriterio, "id" | "documento" | "linea"> = Object.freeze({
  niveles: [],
  nivelesInvalidos: [],
  clase: null,
  claseValida: true,
  exigeTest: false,
  formaValida: false,
  porton: null,
});

/**
 * Extrae Evidencia/Clase del texto que define un `AC-`.
 *
 * Si el texto todavia no contiene "Evidencia:" — porque envuelve a mas
 * lineas de las que ya se acumularon — devuelve una forma vacia y
 * `formaValida: false`; quien llama decide si sigue acumulando.
 */
export function parsearEvidencia(texto: string): Omit<EvidenciaDeCriterio, "id" | "documento" | "linea"> {
  const coincidenciaEvidencia = PATRON_EVIDENCIA.exec(texto);
  if (!coincidenciaEvidencia) return { ...SIN_EVIDENCIA };

  const niveles = [...coincidenciaEvidencia[1].matchAll(/`([A-Z]+)`/g)].map((m) => m[1]);
  const nivelesValidos = niveles.filter((n): n is Nivel => (NIVELES as readonly string[]).includes(n));
  const nivelesInvalidos = niveles.filter((n) => !(NIVELES as readonly string[]).includes(n));

  const coincidenciaClase = PATRON_CLASE.exec(texto);
  const clase = coincidenciaClase ? coincidenciaClase[1] : null;

  const exigeTest = nivelesValidos.includes("TEST");

  return {
    niveles: nivelesValidos,
    nivelesInvalidos,
    clase,
    claseValida: clase === null || (CLASES as readonly string[]).includes(clase),
    exigeTest,
    // AC-HECHO-03: clase obligatoria si y solo si el nivel incluye TEST.
    formaValida: (exigeTest && clase !== null) || (!exigeTest && clase === null),
    porton: portonExclusivo(nivelesValidos),
  };
}

/** Tope de lineas de envoltura de prosa tras la definicion. Ninguna hoy pasa de 5. */
const MAX_LINEAS_DE_ENVOLTURA = 8;

/**
 * Recoge, para cada `AC-` definido, su texto de evidencia.
 *
 * El enunciado envuelve a varias lineas de prosa (markdown a ~80 columnas)
 * antes de llegar a `Evidencia:`. Se acumula hasta encontrarla o hasta que
 * empiece el siguiente item de lista, lo que llegue antes.
 */
export function recogerEvidenciasDeCriterios(documentos: Documento[]): Map<string, EvidenciaDeCriterio> {
  const resultado = new Map<string, EvidenciaDeCriterio>();

  for (const documento of documentos) {
    documento.lineas.forEach((linea, indice) => {
      if (documento.dentroDeCerca[indice]) return;
      const encabezaDefinicion = /^\s*[-*]\s+`(AC-[A-Z][A-Z0-9]*-\d+)`/.exec(linea);
      if (!encabezaDefinicion) return;

      const id = encabezaDefinicion[1];
      const partes = [linea];
      // Se acumula hasta que la evidencia este completa: "Evidencia:" puede
      // quedar al final de una linea y su valor (`TEST`) envuelto a la
      // siguiente (`AC-PRUEBA-05`), y "Clase:" puede ir en una tercera linea
      // distinta de la de "Evidencia:" (`AC-HECHO-01`, `AC-TRAZ-03`,
      // `AC-PLAN-01`, `AC-PUENTE-03`). Sigue mientras falte el nivel, o
      // mientras falte la clase de un criterio que exige `TEST` — hasta que
      // el propio texto confirme que no hay mas clase que buscar (siguiente
      // item de lista) o se agote el tope.
      let analisis = parsearEvidencia(partes.join(" "));
      for (
        let salto = 1;
        salto <= MAX_LINEAS_DE_ENVOLTURA &&
        (analisis.niveles.length === 0 || (analisis.exigeTest && analisis.clase === null));
        salto += 1
      ) {
        const siguiente = documento.lineas[indice + salto];
        if (siguiente === undefined) break;
        if (/^\s*[-*]\s+`?[A-Z]/.test(siguiente)) break; // siguiente item de lista
        partes.push(siguiente);
        analisis = parsearEvidencia(partes.join(" "));
      }

      resultado.set(id, {
        id,
        documento: documento.ruta,
        linea: indice + 1,
        ...analisis,
      });
    });
  }

  return resultado;
}
