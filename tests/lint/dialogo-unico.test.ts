// `AC-DS-04` (`16`, `51` §6.4 `dialogo-unico`): `role="dialog"` solo dentro
// del componente `Dialog` del sistema de diseño. Excluye
// `src/features/**` (REEMPLAZAR) y `src/shared/accessibility/` (el
// `modal-accessibility-guard`, que existe justamente porque hoy hay diálogos
// mal construidos fuera de `features/` y desaparece en `W-06` cuando dejen
// de existir — `54` W-06).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features"), join(RAIZ_SRC, "shared", "accessibility")];
const PATRON = /role=["']dialog["']/;

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

describe("AC-DS-04 (dialogo-unico): role=\"dialog\" no aparece fuera del sistema de diseño", () => {
  const ficheros = ficherosTsx(RAIZ_SRC, []);

  it("ningún fichero fuera de features/ y shared/accessibility/ declara role=\"dialog\"", () => {
    const infractores = ficheros.filter((f) => PATRON.test(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });
});
