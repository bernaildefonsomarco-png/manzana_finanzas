#!/usr/bin/env node
// Gate de clase `build` para `AC-SEG-01` (`15` §5, §9).
//
//   Regla: ningún archivo bajo src/app/api/ puede importar
//   createServiceClient salvo los que figuran en la lista blanca explícita.
//
// Dos listas (`service-role-lista.ts`): la permanente (trabajadores,
// webhooks, salud, los dos casos de `15` §4 que sí necesitan el rol para
// siempre) y las excepciones temporales de `/api/v1` pendientes de migrar
// junto con `14` y los contratos de cada corte (`WEB-D168`). Cualquier importación
// fuera de las dos falla el build. Una entrada de la lista que ya no
// corresponde a ninguna importación real también falla — la lista debe
// seguir siendo exacta, no solo permisiva.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { EXCEPCIONES_TEMPORALES, LISTA_BLANCA_PERMANENTE, type EntradaLista } from "./service-role-lista.ts";

const RAIZ_API = join("src", "app", "api");

export interface RutaApi {
  /** Ruta relativa a `src/app/api/`, con `/` como separador, sin `/route.ts`. */
  ruta: string;
  rutaSistema: string;
  usaServiceRole: boolean;
}

function recorrer(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio).sort()) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      recorrer(ruta, acumulado);
    } else if (entrada === "route.ts") {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

/** Lee `src/app/api/` y dice, de cada `route.ts`, si importa `createServiceClient`. */
export function leerRutasApi(raiz: string = RAIZ_API): RutaApi[] {
  return recorrer(raiz, []).map((rutaSistema) => {
    const contenido = readFileSync(rutaSistema, "utf8");
    const carpeta = relative(raiz, rutaSistema).split(sep).slice(0, -1).join("/");
    return {
      ruta: carpeta,
      rutaSistema,
      usaServiceRole: /createServiceClient/.test(contenido),
    };
  });
}

/** `*` coincide con exactamente un segmento (incluidos los dinámicos `[id]`). */
export function coincidePatron(ruta: string, patron: string): boolean {
  const segmentosRuta = ruta.split("/");
  const segmentosPatron = patron.split("/");
  if (segmentosRuta.length !== segmentosPatron.length) return false;
  return segmentosPatron.every((segmento, i) => segmento === "*" || segmento === segmentosRuta[i]);
}

export interface ResultadoGate {
  ok: boolean;
  sinJustificar: string[];
  entradasObsoletas: string[];
}

/**
 * Verifica el gate completo: toda ruta que usa service-role está
 * justificada, y toda excepción **temporal** corresponde a una ruta real que
 * de verdad lo sigue usando.
 *
 * La lista permanente puede declarar una categoría (`health/*`) sin que hoy
 * exista ningún fichero que la use — es una categoría de diseño de `15` §4,
 * no un hecho derivado, y no caduca por quedarse vacía un tiempo. La lista
 * temporal es distinta a propósito: mide progreso real hacia `AC-SEG-07`
 * (vacía antes del lanzamiento), así que una entrada que ya no usa
 * service-role debe salir de la lista cuando se migra, no quedar como
 * recuerdo.
 */
export function verificarServiceRoleEnRutas(raiz: string = RAIZ_API): ResultadoGate {
  const rutas = leerRutasApi(raiz);
  const listas: EntradaLista[] = [...LISTA_BLANCA_PERMANENTE, ...EXCEPCIONES_TEMPORALES];

  const sinJustificar = rutas
    .filter((r) => r.usaServiceRole)
    .filter((r) => !listas.some((entrada) => coincidePatron(r.ruta, entrada.patron)))
    .map((r) => r.ruta);

  const entradasObsoletas = EXCEPCIONES_TEMPORALES.filter(
    (entrada) => !rutas.some((r) => r.usaServiceRole && coincidePatron(r.ruta, entrada.patron))
  ).map((entrada) => entrada.patron);

  return {
    ok: sinJustificar.length === 0 && entradasObsoletas.length === 0,
    sinJustificar,
    entradasObsoletas,
  };
}

function main(): void {
  const resultado = verificarServiceRoleEnRutas();
  if (!resultado.ok) {
    if (resultado.sinJustificar.length > 0) {
      console.error("[gate:service-role] Rutas que usan createServiceClient sin justificación:");
      for (const ruta of resultado.sinJustificar) console.error(`  - ${ruta}`);
    }
    if (resultado.entradasObsoletas.length > 0) {
      console.error("[gate:service-role] Entradas de la lista que ya no corresponden a ninguna ruta real:");
      for (const patron of resultado.entradasObsoletas) console.error(`  - ${patron}`);
    }
    process.exit(1);
  }
  console.log("[gate:service-role] OK — toda importación de createServiceClient está justificada.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
