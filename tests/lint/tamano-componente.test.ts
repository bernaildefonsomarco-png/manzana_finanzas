// `AC-ARQ-04` (`12`, `51` §6.4 `tamano-componente`): un componente no supera
// ~150 líneas sin justificación registrada. Excluye `src/features/**`
// (REEMPLAZAR, `52`; `WEB-D164`) — ahí viven los infractores conocidos
// (`money-screen.tsx` 2.360 líneas, entre otros) y desaparecen con sus
// ficheros, no se arreglan.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features")];
const LIMITE = 150;

/**
 * Excepciones registradas y justificadas (`51` §6.4: "sin justificación
 * registrada" implica que CON justificación sí se permite).
 */
const JUSTIFICADOS: Record<string, string> = {
  "app/(publico)/empresa/page.tsx":
    "Página legal de prosa estática, no un componente interactivo — el límite de 150 líneas gobierna la complejidad de UI, no el texto legal.",
};

function componentesTsx(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (EXCLUIDOS.some((ex) => ruta.startsWith(ex))) continue;
    if (statSync(ruta).isDirectory()) {
      componentesTsx(ruta, acumulado);
    } else if (entrada.endsWith(".tsx") && !entrada.endsWith(".test.tsx")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-ARQ-04 (tamano-componente): ningún componente supera 150 líneas sin justificar", () => {
  const ficheros = componentesTsx(RAIZ_SRC, []);

  it("ningún .tsx fuera de src/features/ supera 150 líneas, salvo los justificados", () => {
    const infractores = ficheros
      .map((f) => ({ ruta: relative(RAIZ_SRC, f).split("\\").join("/"), lineas: readFileSync(f, "utf8").split("\n").length }))
      .filter((f) => f.lineas > LIMITE && !JUSTIFICADOS[f.ruta]);
    expect(infractores).toEqual([]);
  });

  it("los ficheros justificados siguen existiendo (si desaparecen, se borra la excepción)", () => {
    for (const ruta of Object.keys(JUSTIFICADOS)) {
      expect(statSync(join(RAIZ_SRC, ruta)).isFile(), `${ruta} ya no existe`).toBe(true);
    }
  });
});
