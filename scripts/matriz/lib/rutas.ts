// `AC-TRAZ-05` (`50` §5.3, `WEB-D152`): el inventario de rutas de `10` §3 se
// genera desde las §8 de los módulos, y un test falla el build si diverge.

import type { Documento } from "./corpus.ts";
import type { EntradaIdentificador } from "./identificadores.ts";
import { buscarLineaDeRuta } from "./superficies.ts";

const DOC_SITEMAP = "10";

/** Extrae las rutas (una celda puede traer varias separadas por coma) de la primera columna de una fila de tabla. */
function rutasDePrimeraCelda(linea: string): string[] {
  const celda = linea.match(/^\|([^|]*)\|/)?.[1] ?? "";
  return [...celda.matchAll(/`(\/[a-z0-9\-/[\]_]*)`/g)].map((m) => m[1]);
}

/** Rutas declaradas en `10` §3.1 y §3.2 — el mapa. */
export function leerMapaDeRutas(documentos: Documento[]): Set<string> {
  const sitemap = documentos.find((d) => d.numero === DOC_SITEMAP);
  if (!sitemap) throw new Error(`No encuentro el documento ${DOC_SITEMAP}.`);

  const rutas = new Set<string>();
  sitemap.lineas.forEach((linea, indice) => {
    if (sitemap.dentroDeCerca[indice]) return;
    const seccion = sitemap.secciones[indice];
    if (seccion !== "§3.1" && seccion !== "§3.2") return;
    for (const ruta of rutasDePrimeraCelda(linea)) rutas.add(ruta);
  });
  return rutas;
}

/**
 * Ruta de una superficie, de donde sea que esté declarada.
 *
 * Los 16 módulos de `04_modulos/` (`24`–`39`) siguen la plantilla de `01` §8
 * y declaran la ruta en una línea `**Ruta:**` tras el encabezado
 * (`RUL-TRAZ-05`). Los seis documentos sin esa plantilla obligatoria (`41`,
 * `43`–`46`, `48`) a veces solo la declaran en la tabla resumen de §8, con
 * la ruta en la última celda (`| SCR-ASI-03 | Conversación completa |
 * /asistente |`) — es la misma prioridad de forma que ya resuelve a qué
 * definición pertenece un `SCR-` (`identificadores.ts`), aplicada aquí a
 * dónde vive su ruta.
 */
function textoDeRutaDeSuperficie(documento: Documento, definicion: { linea: number; textoLinea: string }): string | null {
  const porLinea = buscarLineaDeRuta(documento, definicion.linea);
  if (porLinea) return porLinea.texto;

  if (documento.lineas[definicion.linea - 1].trimStart().startsWith("|")) {
    const celdas = definicion.textoLinea
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|");
    const ultima = celdas[celdas.length - 1]?.trim() ?? "";
    if (/^`\/[a-z0-9\-/[\]?&=<>_]*`$/.test(ultima)) return ultima.replace(/^`|`$/g, "");
  }

  return null;
}

/**
 * Rutas reales (no "ninguna — …") declaradas por los módulos, sin el estado
 * de URL que algunas arrastran (`#anchor`, `?query=`) — el mapa registra la
 * ruta base, `17` registra los parámetros.
 */
export function leerRutasDeclaradasPorModulos(
  documentos: Documento[],
  porId: Map<string, EntradaIdentificador>
): Set<string> {
  const rutas = new Set<string>();

  for (const entrada of porId.values()) {
    if (entrada.familia !== "SCR") continue;

    // La ruta puede vivir junto al encabezado que "gana" como definición
    // (`RUL-TRAZ-05`, docs `24`–`39`) o junto a una fila de tabla que quedó
    // como cita porque el encabezado tenía prioridad (`41`, `43`–`46`, `48`:
    // `SCR-AUTH-01` define su encabezado, pero la ruta solo aparece en la
    // fila resumen). Se busca en todas las apariciones con forma válida del
    // documento dueño, no solo en la definición ganadora.
    const candidatas = [...entrada.definiciones, ...entrada.citas].filter(
      (a) => a.candidataADefinicion && a.documento === entrada.definiciones[0]?.documento
    );
    if (candidatas.length === 0) continue;

    const documento = documentos.find((d) => d.ruta === candidatas[0].documento)!;
    let texto: string | null = null;
    for (const candidata of candidatas) {
      texto = textoDeRutaDeSuperficie(documento, candidata);
      if (texto) break;
    }
    if (!texto) continue;

    const coincidencia = /`?(\/[a-z0-9\-/[\]_]*)`?/.exec(texto);
    if (!coincidencia) continue; // "ninguna — …": no es una ruta
    const base = coincidencia[1].split("?")[0].split("#")[0];
    rutas.add(base);
  }

  return rutas;
}

export interface DiferenciaDeRutas {
  enModulosNoEnMapa: string[];
  enMapaNoEnModulos: string[];
}

/**
 * `AC-TRAZ-05`: compara el mapa contra lo declarado por los módulos. Las
 * rutas de sistema que `10` declara sin que ningún módulo las repita en su
 * `**Ruta:**` (`/`, páginas legales sin módulo `SCR-`, rutas `V1.1` como
 * `/movimientos/importar`) se excluyen explícitamente: el mapa es la fuente
 * para esas, no un espejo de las superficies.
 */
const RUTAS_DE_MAPA_SIN_SUPERFICIE_PROPIA = new Set([
  "/", // WEB-D151: redirección, no una superficie con SCR- propio
  "/movimientos/importar", // V1.1, diferida (WEB-D026)
  // 50 §5.4: paginas publicas existentes con dueño de documento asignado
  // (45 y 48) pero sin SCR- propio — no se confunden con /ayuda/contacto,
  // que si tiene el suyo (SCR-AYUDA-05).
  "/terminos",
  "/empresa",
  "/contacto",
]);

export function compararRutas(documentos: Documento[], porId: Map<string, EntradaIdentificador>): DiferenciaDeRutas {
  const mapa = leerMapaDeRutas(documentos);
  const declaradas = leerRutasDeclaradasPorModulos(documentos, porId);

  const enModulosNoEnMapa = [...declaradas].filter((r) => !mapa.has(r)).sort();
  const enMapaNoEnModulos = [...mapa]
    .filter((r) => !declaradas.has(r) && !RUTAS_DE_MAPA_SIN_SUPERFICIE_PROPIA.has(r))
    .sort();

  return { enModulosNoEnMapa, enMapaNoEnModulos };
}
