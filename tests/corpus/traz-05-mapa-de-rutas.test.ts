// `AC-TRAZ-05` (`50` §5.3, `WEB-D152`): el inventario de rutas de `10` §3
// coincide exactamente con el declarado por las §8 de los módulos. Falla el
// build, no solo la suite (`51` §7).
import { describe, expect, it } from "vitest";
import { leerCorpus } from "../../scripts/matriz/lib/corpus.ts";
import { leerRegistroDeTokens } from "../../scripts/matriz/lib/registro-tokens.ts";
import { extraerApariciones, agruparPorIdentificador } from "../../scripts/matriz/lib/identificadores.ts";
import { compararRutas } from "../../scripts/matriz/lib/rutas.ts";

describe("AC-TRAZ-05: el mapa de 10 §3 no diverge de las rutas declaradas por los módulos", () => {
  const docs = leerCorpus();
  const registro = leerRegistroDeTokens(docs);
  const porId = agruparPorIdentificador(extraerApariciones(docs, registro));
  const diferencia = compararRutas(docs, porId);

  it("ningún módulo declara una ruta que el mapa de 10 §3 no tenga", () => {
    expect(diferencia.enModulosNoEnMapa).toEqual([]);
  });

  it("el mapa de 10 §3 no tiene una ruta que ningún módulo declare (salvo las de sistema)", () => {
    expect(diferencia.enMapaNoEnModulos).toEqual([]);
  });
});
