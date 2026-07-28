// `AC-TRAZ-08` (`50` §10, `RUL-HECHO-01`): ningún criterio en estado
// `verificado` tiene su test en `skip`. La forma directa de comprobarlo hoy
// —antes de que el generador enlace criterios a ficheros de test reales— es
// más fuerte: la suite por defecto no contiene ningún `.skip` en absoluto.
// Lo que legítimamente no corre por diseño vive en su propio proyecto
// (`WEB-D158`, `AC-PRUEBA-07`), nunca como skip dentro del fichero.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

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

describe("AC-TRAZ-08: ningún test de la suite por defecto usa .skip", () => {
  it("cero ficheros usan describe.skip, it.skip o test.skip", () => {
    const ficheros = RAICES.flatMap((raiz) => ficherosDeTest(raiz, []));
    expect(ficheros.length).toBeGreaterThan(100);
    const infractores = ficheros.filter((f) => PATRON_SKIP.test(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(process.cwd(), f))).toEqual([]);
  });
});
