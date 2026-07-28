#!/usr/bin/env node
// Gate de clase `build` para `AC-TRAZ-08` / `RUL-HECHO-01`: ningún test de
// la suite por defecto usa `.skip`.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";

const RAICES = [join(process.cwd(), "src"), join(process.cwd(), "tests")];
const EXCLUIDOS = [join(process.cwd(), "tests", "rls")];
const PATRON_SKIP = /\b(describe|it|test)\.skip\s*\(/;

function ficherosDeTest(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (EXCLUIDOS.some((ex) => ruta.startsWith(ex))) continue;
    if (statSync(ruta).isDirectory()) {
      ficherosDeTest(ruta, acumulado);
    } else if (/\.test\.tsx?$/.test(entrada) && !entrada.endsWith(".api-smoke.test.ts")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

function main(): void {
  const ficheros = RAICES.flatMap((raiz) => ficherosDeTest(raiz, []));
  const infractores = ficheros.filter((f) => PATRON_SKIP.test(readFileSync(f, "utf8")));

  if (infractores.length > 0) {
    console.error("[gate:sin-tests-en-skip] FALLA — AC-TRAZ-08: hay tests marcados .skip:");
    for (const f of infractores) console.error(`  - ${relative(process.cwd(), f)}`);
    process.exit(1);
  }
  console.log("[gate:sin-tests-en-skip] OK — ningún test de la suite por defecto usa .skip.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
