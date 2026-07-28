// `AC-ARQ-01`, `AC-NAV-04` (`10`, `12`, `51` §6.4 `sin-view-query`): ninguna
// ruta lee `?view=` para decidir qué pantalla mostrar. `W-07` borró
// `src/features/dashboard/` (el único infractor, `52` DESCARTAR) y puso
// rutas reales — la regla ya no necesita ninguna exclusión.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
// Solo la LECTURA de `view` para decidir pantalla es la violación (`10` §1,
// `AC-ARQ-01`). Construir un enlace de salida que todavía apunta al patrón
// antiguo (p. ej. un worker generando una URL de notificación) es un asunto
// distinto, no cubierto por esta regla.
const PATRON = /searchParams\.get\(\s*["']view["']\s*\)/;

function ficherosTsx(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      ficherosTsx(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada) && !entrada.endsWith(".test.tsx") && !entrada.endsWith(".test.ts")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-ARQ-01 / AC-NAV-04 (sin-view-query): ninguna ruta lee ?view=", () => {
  const ficheros = ficherosTsx(RAIZ_SRC, []);

  it("ningún fichero fuera de src/features/dashboard/ usa el patrón ?view=", () => {
    const infractores = ficheros.filter((f) => PATRON.test(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });
});
