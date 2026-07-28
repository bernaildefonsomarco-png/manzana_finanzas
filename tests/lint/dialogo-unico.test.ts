// `AC-DS-04` (`16`, `51` §6.4 `dialogo-unico`): `role="dialog"` solo dentro
// del componente `Dialog` del sistema de diseño. Excluye
// `src/features/**` (REEMPLAZAR, `WEB-D164`), `src/shared/accessibility/`
// (el `modal-accessibility-guard`, que sigue montado hasta que las
// pantallas condenadas migren — `WEB-D183` — y su propio código consulta
// el selector `[role="dialog"]` sin declarar uno) y las implementaciones
// canónicas `dialog.tsx`/`sheet.tsx`: son las únicas líneas del árbol
// donde `role="dialog"` es correcto por definición (Sheet reutiliza el
// mismo contrato de teclado que Dialog, solo cambia la posición — `16`
// §4.2), no una infracción.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features"), join(RAIZ_SRC, "shared", "accessibility")];
const FICHEROS_EXCLUIDOS = [
  join(RAIZ_SRC, "ui", "primitivas", "dialog.tsx"),
  join(RAIZ_SRC, "ui", "primitivas", "sheet.tsx"),
];
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

  it("ningún fichero fuera de features/, shared/accessibility/, dialog.tsx y sheet.tsx declara role=\"dialog\"", () => {
    const infractores = ficheros
      .filter((f) => !FICHEROS_EXCLUIDOS.includes(f))
      .filter((f) => PATRON.test(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });
});
