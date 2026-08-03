// Utilidades genéricas de parseo de tablas Markdown (`| a | b | c |`), sin
// conocimiento del dominio. `generar.ts` decide qué significa cada columna.

export interface FilaTabla {
  celdas: string[];
  linea: number;
}

const PATRON_FILA = /^\s*\|(.+)\|\s*$/;
const PATRON_SEPARADOR = /^\s*\|?[\s:|-]+\|?\s*$/;

/** Divide una línea `| a | b |` en celdas, recortando espacios. */
function partirCeldas(linea: string): string[] {
  const coincidencia = PATRON_FILA.exec(linea);
  if (!coincidencia) return [];
  return coincidencia[1].split("|").map((celda) => celda.trim());
}

/**
 * Extrae todas las tablas Markdown dentro de un rango de líneas `[desde, hasta)`.
 * Cada tabla es la fila de cabecera + las de datos (se salta la fila de
 * separador `|---|---|`). Ignora líneas dentro de bloques cercados.
 */
export function extraerTablas(
  lineas: string[],
  dentroDeCerca: boolean[],
  desde: number,
  hasta: number,
): FilaTabla[][] {
  const tablas: FilaTabla[][] = [];
  let actual: FilaTabla[] | null = null;

  for (let i = desde; i < hasta && i < lineas.length; i += 1) {
    if (dentroDeCerca[i]) continue;
    const linea = lineas[i];
    const esFilaDeTabla = PATRON_FILA.test(linea);

    if (!esFilaDeTabla) {
      if (actual && actual.length > 0) tablas.push(actual);
      actual = null;
      continue;
    }
    if (PATRON_SEPARADOR.test(linea) && /-{2,}/.test(linea)) {
      // Fila separadora `|---|---|`: no aporta datos.
      if (!actual) actual = [];
      continue;
    }
    if (!actual) actual = [];
    actual.push({ celdas: partirCeldas(linea), linea: i });
  }
  if (actual && actual.length > 0) tablas.push(actual);
  return tablas;
}

/**
 * Todos los identificadores entre backticks de una celda: `` `a`, `b` `` → ["a","b"].
 * Admite identificadores que empiezan por dígito (números de documento como
 * `26` o `20b`), no solo los que empiezan por letra.
 */
export function identificadoresDeCelda(celda: string): string[] {
  return [...celda.matchAll(/`([a-zA-Z0-9_]+)`/g)].map((m) => m[1]);
}
