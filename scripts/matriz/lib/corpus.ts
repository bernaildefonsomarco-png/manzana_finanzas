// Lectura del corpus de `documentacion/app_web/`.
//
// El generador de la matriz (`50` §8) no puede depender de nada de la
// aplicacion: lee ficheros de texto y nada mas. Por eso vive en `scripts/` y
// no en `src/`.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export const RAIZ_CORPUS = join("documentacion", "app_web");

/** Bloques de gobierno cuyos documentos no declaran identificadores propios. */
const BLOQUE_GOBIERNO = "00_gobierno";

export interface Documento {
  ruta: string;
  rutaSistema: string;
  numero: string;
  bloque: string;
  esGobierno: boolean;
  contenido: string;
  lineas: string[];
  dentroDeCerca: boolean[];
  secciones: string[];
}

function recorrer(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio).sort()) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      recorrer(ruta, acumulado);
    } else if (entrada.endsWith(".md")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

/**
 * Marca que lineas caen dentro de un bloque de codigo cercado.
 *
 * Importa para el parseo: dentro de un bloque cercado el corpus dibuja
 * pantallas en ASCII, muestra sintaxis con marcadores (`AC-XXX-NN`) y pega
 * fragmentos de SQL. Nada de eso define un identificador.
 */
function marcarCercas(lineas: string[]): boolean[] {
  const dentro = new Array<boolean>(lineas.length).fill(false);
  let abierto = false;
  for (let i = 0; i < lineas.length; i += 1) {
    if (/^\s*```/.test(lineas[i])) {
      // La linea de apertura y la de cierre cuentan como dentro.
      dentro[i] = true;
      abierto = !abierto;
      continue;
    }
    dentro[i] = abierto;
  }
  return dentro;
}

/**
 * Numero de seccion (`## N.` o `### N.M`) vigente en cada linea.
 *
 * La plantilla de modulo (`01` §8) numera sus 22 secciones, y la matriz
 * necesita la seccion para la columna `seccion` de `50` §4.
 */
function marcarSecciones(lineas: string[], dentroDeCerca: boolean[]): string[] {
  const secciones = new Array<string>(lineas.length).fill("");
  let actual = "";
  for (let i = 0; i < lineas.length; i += 1) {
    if (dentroDeCerca[i]) {
      secciones[i] = actual;
      continue;
    }
    const encabezado = /^(#{2,6})\s+(\d+(?:\.\d+)*)[.\s]/.exec(lineas[i]);
    if (encabezado) {
      actual = `§${encabezado[2]}`;
    }
    secciones[i] = actual;
  }
  return secciones;
}

/**
 * Numero de documento tal como lo cita el corpus (`24`, `20b`, `50`).
 *
 * Sale del nombre del fichero, que empieza siempre por el numero de escritura.
 */
export function numeroDeDocumento(rutaRelativa: string): string {
  const nombre = rutaRelativa.split(sep).pop() ?? "";
  const coincidencia = /^(\d+[a-z]?)_/.exec(nombre);
  return coincidencia ? coincidencia[1] : "";
}

/** Lee el corpus entero. Devuelve un documento por fichero `.md`. */
export function leerCorpus(raiz: string = RAIZ_CORPUS): Documento[] {
  return recorrer(raiz, []).map((ruta) => {
    const contenido = readFileSync(ruta, "utf8");
    const lineas = contenido.split(/\r?\n/);
    const dentroDeCerca = marcarCercas(lineas);
    return {
      ruta: relative(process.cwd(), ruta).split(sep).join("/"),
      rutaSistema: ruta,
      numero: numeroDeDocumento(ruta),
      bloque: relative(raiz, ruta).split(sep)[0],
      esGobierno: relative(raiz, ruta).split(sep)[0] === BLOQUE_GOBIERNO,
      contenido,
      lineas,
      dentroDeCerca,
      secciones: marcarSecciones(lineas, dentroDeCerca),
    };
  });
}
