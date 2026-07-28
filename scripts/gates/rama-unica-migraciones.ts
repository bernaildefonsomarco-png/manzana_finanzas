#!/usr/bin/env node
// Gate de clase `build` para `AC-INV-07` (`WEB-D163`, `52` §12, `53` D-05).
//
// `supabase/migrations/` es la única rama de migraciones. Este gate falla si
// vuelve a existir un segundo árbol de ficheros `.sql` en
// `src/data/migrations/` — que es exactamente el patrón que ya diverge cuatro
// veces en este proyecto (`C-03`, páginas legales, mapa de rutas, y esta
// misma carpeta antes del saneamiento).
//
// Se ejecuta en dos sitios: como test de `npm test` (feedback rápido) y como
// `prebuild` (impide desplegar, no solo falla una suite — `51` §7).

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const CARPETA_PROHIBIDA = join("src", "data", "migrations");

export interface ResultadoGate {
  ok: boolean;
  motivo?: string;
}

/**
 * Verifica que no exista una segunda rama de migraciones.
 *
 * @param raizProyecto la raiz del repositorio; parametrizado para poder
 *   probar el gate contra un fixture temporal sin tocar el árbol real
 *   (`AC-PRUEBA-08`: se verifica introduciendo la violación a propósito).
 */
export function verificarRamaUnicaDeMigraciones(raizProyecto: string = process.cwd()): ResultadoGate {
  const carpeta = join(raizProyecto, CARPETA_PROHIBIDA);
  if (!existsSync(carpeta)) return { ok: true };

  const sqlEncontrados = readdirSync(carpeta).filter((f) => f.endsWith(".sql"));
  if (sqlEncontrados.length === 0) return { ok: true };

  return {
    ok: false,
    motivo:
      `${CARPETA_PROHIBIDA} contiene ${sqlEncontrados.length} fichero(s) .sql. ` +
      `supabase/migrations/ es la única rama permitida (WEB-D163).`,
  };
}

function main(): void {
  const resultado = verificarRamaUnicaDeMigraciones();
  if (!resultado.ok) {
    console.error(`[gate:rama-unica-migraciones] FALLA — ${resultado.motivo}`);
    process.exit(1);
  }
  console.log("[gate:rama-unica-migraciones] OK — una sola rama de migraciones.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
