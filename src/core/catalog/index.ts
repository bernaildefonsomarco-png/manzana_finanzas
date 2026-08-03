// Catálogo de comandos y vocabulario en tiempo de ejecución (`40`, `W-16`).
//
// `AC-CATALOGO-10`: la lista blanca vive aquí, en el ejecutor — no en el
// prompt del modelo. Cualquier código que decida si un comando existe, qué
// nivel de confirmación exige, o si una dimensión/medida es válida, pasa por
// estas funciones y nunca por una lista propia.

import { CATALOGO_GENERADO } from "./generated.ts";
import type { Alias, Comando, Dimension, Medida, NivelConfirmacion } from "./types.ts";

export { NIVELES_CONFIRMACION } from "./types.ts";
export type { Alias, Comando, Dimension, Medida, NivelConfirmacion } from "./types.ts";

const COMANDOS_POR_NOMBRE = new Map<string, Comando>(
  CATALOGO_GENERADO.comandos.map((comando) => [comando.nombre, comando]),
);

const DIMENSIONES_POR_NOMBRE = new Map<string, Dimension>(
  CATALOGO_GENERADO.dimensiones.map((dimension) => [dimension.nombre, dimension]),
);

const MEDIDAS_POR_NOMBRE = new Map<string, Medida>(
  CATALOGO_GENERADO.medidas.map((medida) => [medida.nombre, medida]),
);

const ALIAS_POR_NOMBRE = new Map<string, Alias>(
  CATALOGO_GENERADO.alias.map((alias) => [alias.nombre, alias]),
);

/** `AC-CATALOGO-10`: rechaza cualquier comando fuera del catálogo cerrado de `40` §7. */
export function esComandoConocido(nombre: string): boolean {
  return COMANDOS_POR_NOMBRE.has(nombre);
}

export function obtenerComando(nombre: string): Comando | null {
  return COMANDOS_POR_NOMBRE.get(nombre) ?? null;
}

/** `40` §3.1: el nivel real de un comando — vacío si el nombre no existe. */
export function nivelesDeComando(nombre: string): NivelConfirmacion[] {
  return COMANDOS_POR_NOMBRE.get(nombre)?.niveles ?? [];
}

/** `WEB-D013`: ningún comando de nivel `ninguna` puede tocar dinero por diseño del catálogo (`AC-CATALOGO-04`, verificado en `tests/corpus/catalogo.test.ts`). */
export function esComandoDeNivel(nombre: string, nivel: NivelConfirmacion): boolean {
  return nivelesDeComando(nombre).includes(nivel);
}

/** `20b` §5.3: valida un nombre de dimensión, medida o alias del vocabulario abierto de lectura. */
export function esEntradaDeLecturaConocida(nombre: string): boolean {
  return DIMENSIONES_POR_NOMBRE.has(nombre) || MEDIDAS_POR_NOMBRE.has(nombre) || ALIAS_POR_NOMBRE.has(nombre);
}

export function esDimensionConocida(nombre: string): boolean {
  return DIMENSIONES_POR_NOMBRE.has(nombre);
}

export function esMedidaConocida(nombre: string): boolean {
  return MEDIDAS_POR_NOMBRE.has(nombre) || ALIAS_POR_NOMBRE.has(nombre);
}

/** `40` §6.3: las tres medidas (o sus alias) que exigen advertencia obligatoria al presentarse. */
export function medidaExigeAdvertencia(nombre: string): boolean {
  const medida = MEDIDAS_POR_NOMBRE.get(nombre);
  if (medida) return medida.advertencia;
  const alias = ALIAS_POR_NOMBRE.get(nombre);
  if (!alias) return false;
  // Un alias hereda la advertencia de la medida base que declara en `equivaleA`
  // (p. ej. `libre_por_cuenta` → `libre_en_cuentas`, sin advertencia; ninguno
  // de los 5 alias actuales apunta a una medida con advertencia, pero la regla
  // se resuelve en vivo en vez de asumirlo).
  for (const base of MEDIDAS_POR_NOMBRE.values()) {
    if (base.advertencia && alias.equivaleA.includes(`\`${base.nombre}\``)) return true;
  }
  return false;
}

export function comandosDelModulo(dueño: string): Comando[] {
  return CATALOGO_GENERADO.comandos.filter((comando) => comando.dueño === dueño);
}

export const censoCatalogo = CATALOGO_GENERADO.censo;
