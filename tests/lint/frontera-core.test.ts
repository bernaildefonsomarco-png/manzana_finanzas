// `AC-ARQ-07` (`12`, `51` §6.4 `frontera-core`): `core/` nunca importa React
// ni Next.js. Activo desde `W-03`: hoy no tiene ninguna violación.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_CORE = join(process.cwd(), "src", "core");
const PATRON_PROHIBIDO = /from\s+["'](react|react-dom|next)(\/[^"']*)?["']/;

function ficherosTs(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      ficherosTs(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada) && !entrada.endsWith(".test.ts")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-ARQ-07 (frontera-core): src/core/ no importa React ni Next", () => {
  const ficheros = ficherosTs(RAIZ_CORE, []);

  it("hay ficheros que revisar", () => {
    expect(ficheros.length).toBeGreaterThan(50);
  });

  it("ninguno importa react, react-dom ni next", () => {
    const infractores = ficheros.filter((f) => PATRON_PROHIBIDO.test(readFileSync(f, "utf8")));
    expect(infractores).toEqual([]);
  });
});
