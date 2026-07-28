#!/usr/bin/env node
// Gate de clase `build` para `AC-TRAZ-09`: nada marcado `FUERA` en `07` §3
// tiene fila con `componente` no vacío en la matriz.

import { pathToFileURL } from "node:url";
import { generarMatriz } from "../matriz/generar.ts";

function main(): void {
  const matriz = generarMatriz();
  const conComponente = matriz.filas.filter((f) => f.componente !== null);

  if (conComponente.length > 0) {
    console.error("[gate:sin-regresion-de-alcance] FALLA — AC-TRAZ-09: filas con componente sin revisar contra 07 §3:");
    for (const f of conComponente) console.error(`  - ${f.id}`);
    process.exit(1);
  }
  console.log("[gate:sin-regresion-de-alcance] OK.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
