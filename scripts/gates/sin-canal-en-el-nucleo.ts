#!/usr/bin/env node
// Gate de clase `lint` para `AC-INV-04` (`52` §4.1, `21`, `WEB-D162`).
//
//   Regla: ningún fichero de src/core/ menciona un canal concreto.
//
// "Mencionar" se mide como el 52 y el WEB-D169 lo midieron: la palabra
// "whatsapp", en cualquier forma, en cualquier fichero que no sea de
// prueba. La lista de abajo es la excepción exacta y documentada —no un
// permiso amplio— para los tres tipos de caso que WEB-D170, WEB-D171 y
// WEB-D172 dejaron fuera del alcance de esta auditoría:
//
//   - el puerto mismo (src/core/channel/types.ts), que declara el tipo
//     Canal que el resto del arbol usa como parametro;
//   - la taxonomia de superficies de disclosure (WEB-D171), un concepto
//     distinto del canal de 21;
//   - lecturas de columnas ya persistidas, variables de entorno ya
//     desplegadas, patrones de texto que clasifican lo que el *usuario*
//     escribio, y las funciones que traducen entre el vocabulario del
//     puerto ("dashboard") y el de un esquema ya persistido
//     ("dashboard_manual") — todos cubiertos por WEB-D172.
//
// Cualquier fichero nuevo que aparezca aqui sin una entrada en el decision
// log es exactamente el defecto que este gate existe para atrapar.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const RAIZ_CORE = join("src", "core");

export const FICHEROS_EXENTOS = [
  "src/core/catalog/generated.ts",
  "src/core/channel/types.ts",
  "src/core/conversation/grounded-response-composer.ts",
  "src/core/conversation/tool-gateway.ts",
  "src/core/dedup/email-pending-reconciler.ts",
  "src/core/disclosure/disclosure-engine.ts",
  "src/core/disclosure/output-guard.ts",
  "src/core/events/domain-events.ts",
  "src/core/finance/commands.ts",
  "src/core/nudges/nudge-policy.ts",
  "src/core/nudges/proactive-activation.ts",
  "src/core/orchestrator/data-action-executor.ts",
  "src/core/orchestrator/data-action-policy.ts",
  "src/core/pending/confirm-pending.ts",
].sort();

function recorrer(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio).sort()) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      recorrer(ruta, acumulado);
    } else if (entrada.endsWith(".ts") && !entrada.endsWith(".test.ts")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

function aPosix(ruta: string): string {
  return ruta.split("\\").join("/");
}

export interface ResultadoGate {
  ok: boolean;
  /** Ficheros que mencionan "whatsapp" y no están en la lista de exentos. */
  sinJustificar: string[];
  /** Entradas de la lista que ya no mencionan "whatsapp" — la lista debe achicarse con ellas. */
  entradasObsoletas: string[];
}

export function verificarSinCanalEnElNucleo(raiz: string = RAIZ_CORE): ResultadoGate {
  const ficheros = recorrer(raiz, []).map(aPosix);
  const conMencion = new Set(
    ficheros.filter((ruta) => /whatsapp/i.test(readFileSync(ruta, "utf8")))
  );

  const sinJustificar = [...conMencion].filter(
    (ruta) => !FICHEROS_EXENTOS.includes(ruta)
  );
  const entradasObsoletas = FICHEROS_EXENTOS.filter(
    (ruta) => !conMencion.has(ruta)
  );

  return {
    ok: sinJustificar.length === 0 && entradasObsoletas.length === 0,
    sinJustificar,
    entradasObsoletas,
  };
}

function main(): void {
  const resultado = verificarSinCanalEnElNucleo();
  if (!resultado.ok) {
    if (resultado.sinJustificar.length > 0) {
      console.error("[gate:sin-canal-en-el-nucleo] Ficheros que mencionan \"whatsapp\" sin excepción documentada:");
      for (const ruta of resultado.sinJustificar) console.error(`  - ${ruta}`);
    }
    if (resultado.entradasObsoletas.length > 0) {
      console.error("[gate:sin-canal-en-el-nucleo] Excepciones que ya no corresponden a ningún fichero real:");
      for (const ruta of resultado.entradasObsoletas) console.error(`  - ${ruta}`);
    }
    process.exit(1);
  }
  console.log("[gate:sin-canal-en-el-nucleo] OK — src/core/ no menciona whatsapp fuera de las excepciones documentadas.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
