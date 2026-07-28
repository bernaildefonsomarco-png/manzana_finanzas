// `AC-NAV-01` (`10` §3.1, §3.2): toda pantalla responde en su propia URL.
// Reclasificado de `e2e` a `build`/corpus en `W-07` (`WEB-D187`): no hace
// falta un navegador para comprobar que una ruta existe y que el árbol de
// `src/app/` no tiene páginas huérfanas fuera del mapa de `10` §3 — eso ya
// lo mide `npm run build` (genera estáticamente las 39 rutas) y este test.
//
// Comprueba una sola dirección: cada `page.tsx` real de `(app)`/`(publico)`
// tiene una ruta declarada en `10` §3. No comprueba la dirección contraria
// (que exista un fichero por cada ruta que `10` declara) porque una buena
// parte de `10` §3.2 pertenece a documentos de módulo que `W-07` no
// construye (`25`, `28`, `29`, `31`, `35`, `36`, `37`, `38`, `41`, `45`,
// `48` — sus propios cortes, `W-08` en adelante); exigirlo aquí repetiría
// el error que `WEB-D167`/`WEB-D175` ya corrigieron en otros documentos.
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { leerCorpus } from "../../scripts/matriz/lib/corpus.ts";
import { leerMapaDeRutas } from "../../scripts/matriz/lib/rutas.ts";

const RAIZ_APP = join(process.cwd(), "src", "app");

function paginasReales(directorio: string, base: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    if (entrada.startsWith("@")) continue; // ranuras paralelas, no rutas propias
    if (entrada === "api") continue;
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      // Los grupos de rutas `(publico)`/`(app)` no aportan segmento a la URL.
      const esGrupo = entrada.startsWith("(") && entrada.endsWith(")");
      // Los interceptores `(.)[id]` tampoco son la ruta propia: la sirve `[id]/page.tsx`.
      const esInterceptor = entrada.startsWith("(.)");
      const siguienteBase = esGrupo || esInterceptor ? base : `${base}/${entrada}`;
      paginasReales(ruta, siguienteBase, acumulado);
    } else if (entrada === "page.tsx") {
      acumulado.push(base === "" ? "/" : base);
    }
  }
  return acumulado;
}

describe("AC-NAV-01 (reclasificado build/corpus, WEB-D187): toda página real tiene ruta declarada en 10 §3", () => {
  const mapa = leerMapaDeRutas(leerCorpus());
  const paginas = paginasReales(RAIZ_APP, "", []);

  it("ninguna página de (app)/(publico) es huérfana del mapa de 10 §3", () => {
    // Los segmentos dinámicos de Next (`[id]`) coinciden literalmente con
    // cómo `10` §3 los escribe.
    const huerfanas = paginas.filter((ruta) => !mapa.has(ruta));
    expect(huerfanas).toEqual([]);
  });

  it("el árbol real tiene al menos las rutas que W-07 se propuso construir", () => {
    expect(paginas.length).toBeGreaterThanOrEqual(30);
  });
});
