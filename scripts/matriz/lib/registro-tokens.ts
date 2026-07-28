// El registro de tokens de `50` §2, leido de su propia tabla.
//
// `WEB-D143`: el token no se infiere, se asigna. Este modulo es el unico sitio
// donde el generador aprende que token pertenece a que documento, y de ahi
// salen `AC-TRAZ-02` (ningun token fuera del registro) y la nocion de
// "documento dueño" que distingue una definicion de una cita.

import type { Documento } from "./corpus.ts";

const DOC_REGISTRO = "50";

export interface RegistroDeTokens {
  porToken: Map<string, string>;
  porNombreLargo: Map<string, string>;
}

/**
 * Lee `50` §2.1 y §2.2.
 *
 * §2.1 son los modulos: `| doc | MOD-LARGO | TOKEN | familias |`.
 * §2.2 son los demas:   `| doc | TOKEN | que gobierna |`.
 */
export function leerRegistroDeTokens(documentos: Documento[]): RegistroDeTokens {
  const registro = documentos.find((documento) => documento.numero === DOC_REGISTRO);
  if (!registro) {
    throw new Error(`No encuentro el documento ${DOC_REGISTRO} en el corpus.`);
  }

  const porToken = new Map<string, string>();
  const porNombreLargo = new Map<string, string>();

  registro.lineas.forEach((linea, indice) => {
    if (registro.dentroDeCerca[indice]) return;
    const seccion = registro.secciones[indice];
    if (seccion !== "§2.1" && seccion !== "§2.2") return;

    const celdas = filaDeTabla(linea);
    if (!celdas) return;

    if (seccion === "§2.1") {
      const [doc, nombreLargo, token] = celdas;
      if (!/^\d+[a-z]?$/.test(doc)) return;
      if (!/^MOD-[A-Z]+$/.test(nombreLargo)) return;
      porToken.set(token, doc);
      porNombreLargo.set(nombreLargo, doc);
    } else {
      const [doc, token] = celdas;
      if (!/^\d+[a-z]?$/.test(doc)) return;
      if (!/^[A-Z][A-Z0-9]*$/.test(token)) return;
      porToken.set(token, doc);
    }
  });

  return { porToken, porNombreLargo };
}

/** Celdas de una fila de tabla markdown, sin comillas ni negritas. */
export function filaDeTabla(linea: string): string[] | null {
  if (!linea.trimStart().startsWith("|")) return null;
  if (/^\s*\|[\s|:-]+\|\s*$/.test(linea)) return null; // separador
  return linea
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((celda) => celda.trim().replace(/^\*\*|\*\*$/g, "").replace(/`/g, "").trim());
}
