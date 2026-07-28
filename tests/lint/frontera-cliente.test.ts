// `AC-ARQ-05` (`12`, `51` §6.4 `frontera-cliente`): un Client Component no
// importa repositorios directos. Excluye `src/features/**`: el `52`
// dictaminó REEMPLAZAR sobre esas 18.142 líneas y `WEB-D164` prohíbe saldar
// deuda en código condenado — hoy tiene una violación ahí
// (`movements-screen.tsx`) que desaparece con el fichero en `W-09`, no aquí.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features")];

function ficherosTsx(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (EXCLUIDOS.some((ex) => ruta.startsWith(ex))) continue;
    if (statSync(ruta).isDirectory()) {
      ficherosTsx(ruta, acumulado);
    } else if (entrada.endsWith(".tsx") && !entrada.endsWith(".test.tsx")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-ARQ-05 (frontera-cliente): un Client Component no importa repositorios", () => {
  const ficheros = ficherosTsx(RAIZ_SRC, []);

  it("ningún Client Component fuera de src/features/ importa (en tiempo de ejecución) @/data/repositories", () => {
    // `import type { X } from "@/data/repositories/..."` se borra al
    // compilar y no trae código de servidor al cliente; solo un import de
    // valor es una violación real de la frontera.
    const infractores = ficheros.filter((f) => {
      const contenido = readFileSync(f, "utf8");
      const esCliente = /^\s*["']use client["'];?/m.test(contenido);
      const importaValor = /^import\s+(?!type\s)[^;]*from\s+["']@\/data\/repositories/m.test(contenido);
      return esCliente && importaValor;
    });
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });
});
