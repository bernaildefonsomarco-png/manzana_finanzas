// El corte dueño de cada documento (`54` §3.1) y las excepciones de
// `RUL-PLAN-04`: un criterio puede cerrarlo un corte distinto del dueño de su
// documento.

import type { Documento } from "./corpus.ts";

const DOC_PLAN = "54";

export interface CortesDelPlan {
  porDocumento: Map<string, string>;
  excepciones: Map<string, string>;
}

/** Lee `54` §3.1: `| W-NN | doc, doc, doc |`. */
export function leerCorteDueño(documentos: Documento[]): Map<string, string> {
  const plan = documentos.find((d) => d.numero === DOC_PLAN);
  if (!plan) throw new Error(`No encuentro el documento ${DOC_PLAN} en el corpus.`);

  const porDocumento = new Map<string, string>();

  plan.lineas.forEach((linea, indice) => {
    if (plan.dentroDeCerca[indice]) return;
    if (plan.secciones[indice] !== "§3.1") return;
    const coincidencia = /^\|\s*`(W-\d+)`\s*\|\s*(.+)\|\s*$/.exec(linea);
    if (!coincidencia) return;

    const corte = coincidencia[1];
    const docs = [...coincidencia[2].matchAll(/`([0-9]+[a-z]?)`/g)].map((m) => m[1]);
    for (const doc of docs) porDocumento.set(doc, corte);
  });

  return porDocumento;
}

/**
 * Excepciones de `RUL-PLAN-04`: criterios que cierra un corte distinto del
 * dueño de su documento. Se leen de `54` §3.1 en vez de repetirlas a mano.
 */
export function leerExcepcionesDeCierre(documentos: Documento[]): Map<string, string> {
  const plan = documentos.find((d) => d.numero === DOC_PLAN)!;
  const excepciones = new Map<string, string>();

  plan.lineas.forEach((linea, indice) => {
    if (plan.dentroDeCerca[indice]) return;
    if (plan.secciones[indice] !== "§3.1") return;
    const coincidencia =
      /^\|\s*`(AC-[A-Z][A-Z0-9]*-\d+)`(?:.*?`(AC-[A-Z][A-Z0-9]*-\d+)`)?[^|]*\|\s*`(W-\d+)`\s*\|/.exec(linea);
    if (!coincidencia) return;
    const corteQueLoCierra = coincidencia[3];
    for (const id of [coincidencia[1], coincidencia[2]].filter((v): v is string => Boolean(v))) {
      excepciones.set(id, corteQueLoCierra);
    }
  });

  return excepciones;
}

/** El corte que cierra un `AC-`: la excepcion si existe, si no el dueño de su documento. */
export function corteQueCierra(
  idAC: string,
  numeroDocumento: string,
  { porDocumento, excepciones }: CortesDelPlan
): string | null {
  return excepciones.get(idAC) ?? porDocumento.get(numeroDocumento) ?? null;
}
