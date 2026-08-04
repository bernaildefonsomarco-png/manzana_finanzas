#!/usr/bin/env node
// Genera el material de apoyo para `W-20` (`54` §7.2): un listado de los
// criterios `G3` con su enunciado completo, agrupado por corte dueño y
// separado por protocolo (`USER` de `49` §8, `METRIC` de `49` §9). `W-20`
// no construye — este script tampoco cierra nada; solo deja el trabajo
// preparado para quien corra las sesiones con personas reales.

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { leerCorpus } from "./lib/corpus.ts";
import { leerRegistroDeTokens } from "./lib/registro-tokens.ts";
import { extraerApariciones, agruparPorIdentificador } from "./lib/identificadores.ts";
import { recogerEvidenciasDeCriterios } from "./lib/criterios.ts";
import { leerCorteDueño, leerExcepcionesDeCierre, corteQueCierra } from "./lib/cortes.ts";

function enunciadoDe(documento: { lineas: string[] }, numeroLinea: number): string {
  // El enunciado puede envolver a varias líneas de Markdown; se junta hasta
  // "Evidencia:", una línea en blanco, o el siguiente criterio de la lista.
  const partes: string[] = [];
  for (let i = numeroLinea - 1; i < documento.lineas.length; i++) {
    const linea = documento.lineas[i] ?? "";
    if (i > numeroLinea - 1 && (linea.trim() === "" || /^-\s*`[A-Z]/.test(linea.trim()))) break;
    partes.push(linea);
    if (/Evidencia:/.test(linea)) break;
  }
  const unido = partes.join(" ").replace(/\s+/g, " ").trim();
  // "- `AC-XXX-NN` — Enunciado. Evidencia: ..." — se recorta antes de "Evidencia:"
  const sinPrefijo = unido.replace(/^-\s*`[^`]+`\s*—\s*/, "");
  const corte = sinPrefijo.split(/Evidencia:/)[0]?.trim() ?? sinPrefijo.trim();
  return corte.replace(/\*\*/g, "").trim() || "(enunciado no extraído automáticamente — ver documento)";
}

function main(): void {
  const documentos = leerCorpus();
  const registro = leerRegistroDeTokens(documentos);
  const apariciones = extraerApariciones(documentos, registro);
  const porId = agruparPorIdentificador(apariciones);
  const evidencias = recogerEvidenciasDeCriterios(documentos);
  const porDocumento = leerCorteDueño(documentos);
  const excepciones = leerExcepcionesDeCierre(documentos);

  type Fila = { id: string; corte: string; documento: string; protocolo: "USER" | "METRIC" | "USER+METRIC"; enunciado: string };
  const filas: Fila[] = [];

  for (const entrada of porId.values()) {
    if (entrada.familia !== "AC") continue;
    const ev = evidencias.get(entrada.id);
    if (!ev || ev.porton !== "G3") continue;

    const definicion = entrada.definiciones[0];
    if (!definicion) continue;
    const documento = documentos.find((d) => d.ruta === definicion.documento);
    if (!documento) continue;

    const corte = corteQueCierra(entrada.id, definicion.numeroDocumento, { porDocumento, excepciones }) ?? "(sin corte)";
    const tieneUser = (ev.niveles ?? []).includes("USER");
    const tieneMetric = (ev.niveles ?? []).includes("METRIC");
    const protocolo = tieneUser && tieneMetric ? "USER+METRIC" : tieneUser ? "USER" : "METRIC";

    filas.push({
      id: entrada.id,
      corte,
      documento: definicion.documento,
      protocolo,
      enunciado: enunciadoDe(documento, definicion.linea),
    });
  }

  filas.sort((a, b) => (a.corte + a.id).localeCompare(b.corte + b.id));

  const porCorte = new Map<string, Fila[]>();
  for (const fila of filas) {
    if (!porCorte.has(fila.corte)) porCorte.set(fila.corte, []);
    porCorte.get(fila.corte)!.push(fila);
  }

  const lineas: string[] = [];
  lineas.push("# Material de apoyo para W-20 — checklist de criterios G3");
  lineas.push("");
  lineas.push(`Generado el ${new Date().toISOString()} con \`npm run matriz:listar-g3\`.`);
  lineas.push("");
  lineas.push(
    "`W-20` no construye (`54` §7.2): este listado no cierra ningún criterio," +
      " es el material para correr el protocolo `USER` (`49` §8, tres personas," +
      " tarea sin ayuda, tres de tres) y abrir las series `METRIC` (`49` §9," +
      " objetivo declarado antes de mirar). El registro real va en" +
      " `55_ledger_construccion_web.md`, con el ID de cada criterio.",
  );
  lineas.push("");
  lineas.push(`**Total: ${filas.length} criterios G3** — ${filas.filter((f) => f.protocolo.includes("USER")).length} con \`USER\`, ${filas.filter((f) => f.protocolo.includes("METRIC")).length} con \`METRIC\`.`);
  lineas.push("");
  lineas.push("## Cómo registrar un resultado");
  lineas.push("");
  lineas.push(
    "**`USER`** (`49` §8, `WEB-D149`): tres personas, ninguna autora del" +
      " documento ni de la implementación, hacen la tarea **sin guía verbal** y" +
      " sin que se les diga dónde está el control. Cierra cuando **las tres**" +
      " completan la tarea — dos de tres no cierra: se corrige y se repite." +
      " Se registra en `55_ledger_construccion_web.md`: fecha, qué se pidió," +
      " qué hizo cada persona, dónde se atascó, y el veredicto por persona.",
  );
  lineas.push("");
  lineas.push(
    "**`METRIC`** (`49` §9, `WEB-D150`): la serie, el objetivo declarado" +
      " **antes** de mirar el dato, y la decisión tomada — los tres, no dos." +
      " Un `METRIC` no bloquea el lanzamiento; bloquea la afirmación de que" +
      " el producto funciona.",
  );
  lineas.push("");
  lineas.push(
    "Ninguno de los dos protocolos lo puede cerrar quien escribió el código" +
      " (`RUL-HECHO-05`): la evidencia la produce quien observa a la persona" +
      " real, no quien implementó el criterio.",
  );
  lineas.push("");

  for (const [corte, filasDelCorte] of porCorte) {
    lineas.push(`## ${corte} (${filasDelCorte.length})`);
    lineas.push("");
    lineas.push("| Criterio | Protocolo | Enunciado | Documento |");
    lineas.push("|---|---|---|---|");
    for (const fila of filasDelCorte) {
      lineas.push(`| \`${fila.id}\` | \`${fila.protocolo}\` | ${fila.enunciado} | \`${fila.documento}\` |`);
    }
    lineas.push("");
  }

  const destino = join(process.cwd(), "documentacion", "app_web", "07_calidad_y_ejecucion", "55c_w20_checklist_g3.md");
  writeFileSync(destino, lineas.join("\n") + "\n", "utf8");
  console.log(`Escrito ${destino} — ${filas.length} criterios G3 en ${porCorte.size} cortes.`);
}

main();
