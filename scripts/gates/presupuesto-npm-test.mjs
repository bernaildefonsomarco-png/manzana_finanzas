#!/usr/bin/env node
// `AC-PRUEBA-11` (`51` §13, clase `presupuesto`): `npm test` no supera los
// 120 segundos. No vive dentro de `npm test` mismo —eso sería recursivo—
// vive en `npm run test:presupuesto`, que lo invoca como subproceso y mide
// el reloj real.

import { spawn } from "node:child_process";

const LIMITE_MS = 120_000;
const inicio = Date.now();

const proceso = spawn("npm", ["test"], { stdio: "inherit", shell: true });

proceso.on("exit", (codigo) => {
  const duracionMs = Date.now() - inicio;
  const segundos = (duracionMs / 1000).toFixed(1);

  if (codigo !== 0) {
    console.error(`[presupuesto:npm-test] npm test falló (código ${codigo}), no se mide el presupuesto.`);
    process.exit(codigo ?? 1);
  }

  if (duracionMs > LIMITE_MS) {
    console.error(`[presupuesto:npm-test] FALLA — ${segundos}s, supera el límite de 120s.`);
    process.exit(1);
  }

  console.log(`[presupuesto:npm-test] OK — ${segundos}s, dentro del límite de 120s.`);
});
