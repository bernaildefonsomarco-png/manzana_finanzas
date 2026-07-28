#!/usr/bin/env node
// Gate de clase `build` para `AC-TRAZ-05`: el mapa de `10` §3 no diverge de
// las rutas declaradas por las §8 de los módulos (`51` §7).

import { pathToFileURL } from "node:url";
import { leerCorpus } from "../matriz/lib/corpus.ts";
import { leerRegistroDeTokens } from "../matriz/lib/registro-tokens.ts";
import { extraerApariciones, agruparPorIdentificador } from "../matriz/lib/identificadores.ts";
import { compararRutas } from "../matriz/lib/rutas.ts";

function main(): void {
  const docs = leerCorpus();
  const registro = leerRegistroDeTokens(docs);
  const porId = agruparPorIdentificador(extraerApariciones(docs, registro));
  const diferencia = compararRutas(docs, porId);

  if (diferencia.enModulosNoEnMapa.length > 0 || diferencia.enMapaNoEnModulos.length > 0) {
    console.error("[gate:mapa-de-rutas] FALLA — AC-TRAZ-05: 10 §3 diverge de las §8 de los módulos.");
    if (diferencia.enModulosNoEnMapa.length > 0) {
      console.error("  En los módulos y no en el mapa:", diferencia.enModulosNoEnMapa.join(", "));
    }
    if (diferencia.enMapaNoEnModulos.length > 0) {
      console.error("  En el mapa y no en los módulos:", diferencia.enMapaNoEnModulos.join(", "));
    }
    process.exit(1);
  }
  console.log("[gate:mapa-de-rutas] OK — el mapa de 10 §3 coincide con las §8 de los módulos.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
