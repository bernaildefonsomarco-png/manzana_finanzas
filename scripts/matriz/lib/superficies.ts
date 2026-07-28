// La linea **Ruta:** de cada superficie (`RUL-TRAZ-05`) y el estado agregado
// de `AC-TRAZ-04` (`WEB-D167`): su conjunto son las 119 `SCR-`, y cierra una
// por una, no de una vez.

import type { Documento } from "./corpus.ts";
import type { EntradaIdentificador } from "./identificadores.ts";

const MAX_LINEAS_TRAS_DEFINICION = 6;

export interface LineaDeRuta {
  linea: number;
  texto: string;
}

export interface FilaDeSuperficie {
  id: string;
  documento: string;
  declaraRuta: boolean;
  textoRuta: string | null;
}

/**
 * Busca la línea `**Ruta:**` que sigue a la definicion de una superficie.
 *
 * Vive pegada al encabezado (`50` §5.1 la exige "sin excepción"): ruta real,
 * o el tratamiento de lo que no tiene ruta propia (`ninguna — modal sobre …`,
 * `ninguna — panel …`, `ninguna — componente, §N`).
 */
export function buscarLineaDeRuta(documento: Documento, lineaDeDefinicion: number): LineaDeRuta | null {
  for (let salto = 1; salto <= MAX_LINEAS_TRAS_DEFINICION; salto += 1) {
    const linea = documento.lineas[lineaDeDefinicion - 1 + salto];
    if (linea === undefined) break;
    const coincidencia = /^\*\*Ruta:\*\*\s*(.+)$/.exec(linea);
    if (coincidencia) return { linea: lineaDeDefinicion + salto, texto: coincidencia[1].trim() };
    // Un nuevo encabezado de superficie cierra la busqueda: no hay Ruta.
    if (/^#{2,6}\s/.test(linea)) break;
  }
  return null;
}

/**
 * Estado de `AC-TRAZ-04` para las 119 superficies: agregado, por documento.
 *
 * Devuelve, por cada `SCR-`, si declara su línea de ruta, y de que documento
 * viene — que decide el corte que puede cerrar esa porcion (`54` §3.1).
 */
export function evaluarSuperficies(
  documentos: Documento[],
  porId: Map<string, EntradaIdentificador>
): FilaDeSuperficie[] {
  const filas: FilaDeSuperficie[] = [];

  for (const entrada of porId.values()) {
    if (entrada.familia !== "SCR") continue;
    const definicion = entrada.definiciones[0];
    if (!definicion) continue; // AC-TRAZ-03 ya lo reporta; aquí no hay nada que buscar

    const documento = documentos.find((d) => d.ruta === definicion.documento)!;
    const ruta = buscarLineaDeRuta(documento, definicion.linea);

    filas.push({
      id: entrada.id,
      documento: definicion.documento,
      declaraRuta: ruta !== null,
      textoRuta: ruta?.texto ?? null,
    });
  }

  filas.sort((a, b) => a.id.localeCompare(b.id));
  return filas;
}
