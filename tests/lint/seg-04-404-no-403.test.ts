// `AC-SEG-04` (`15` §8): un recurso de otro usuario devuelve 404, nunca 403.
// Criterio agregado (`51` §5): su conjunto son las 104 rutas de `/api/v1`
// (`AC-SEG-04` no se cierra con una prueba, se cierra con la unión de que
// ninguna de las 104 use 403 para "no es tuyo" — que es exactamente lo que
// produce el patrón de repositorio del proyecto: toda consulta de un
// recurso filtra por `user_id` e `id` a la vez, así que un recurso ajeno
// simplemente no aparece, nunca se detecta y se rechaza aparte). W-08 sumó
// `v1/accounts/[id]/restore`, la 59; W-09 sumó `v1/movements/[id]/history`,
// la 60; W-10 sumó once: `pending/[id]/already-registered`,
// `pending/[id]/context`, `pending/batch/[batch_id]/undo`,
// `email/suggestions`, `email/suggestions/[id]/{accept,reject,silence}`,
// `templates`, `templates/[id]`, `templates/[id]/use`, `capture/parse`.
// W-11 suma doce: `debts/[id]/close`, `debts/[id]/installments`,
// `debts/[id]/installments/[iid]/{reschedule,skip}`,
// `debts/[id]/payments/preview`, `debts/[id]/reopen`,
// `recurring/[id]/occurrences`,
// `recurring/[id]/occurrences/[occurrence_id]/skip`,
// `recurring/[id]/{pause,resume}`, `recurring/candidates`, `upcoming`.
// W-12 suma veintiuna rutas para presupuestos, metas, proyecciones y
// simulación; las colecciones sin `:id` prueban aislamiento por alcance
// (`WEB-D230`) y las rutas con recurso conservan 404.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_V1 = join(process.cwd(), "src", "app", "api", "v1");

function recorrer(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      recorrer(ruta, acumulado);
    } else if (entrada === "route.ts") {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-SEG-04 (agregado): ninguna de las 104 rutas de /api/v1 usa 403 para un recurso ajeno", () => {
  const rutas = recorrer(RAIZ_V1, []);

  it("el conjunto declarado tiene 104 rutas — si cambia, hay que revisar esta prueba", () => {
    expect(rutas.length).toBe(104);
  });

  it.each(rutas.map((rutaAbsoluta) => [relative(RAIZ_V1, rutaAbsoluta).split("\\").join("/"), rutaAbsoluta]))(
    "%s no devuelve 403",
    (_rutaRelativa, rutaAbsoluta) => {
      const contenido = readFileSync(rutaAbsoluta, "utf8");
      expect(contenido).not.toMatch(/\b403\b/);
    }
  );
});
