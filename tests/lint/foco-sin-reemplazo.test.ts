// `AC-A11Y-02` (`18` §3): "Prohibido `outline: none` sin reemplazo
// equivalente." Cada cadena de clases que quita el contorno con
// `outline-none` debe traer, en la misma cadena, un reemplazo visible:
// un anillo (`ring-*`), un contorno re-declarado, o un cambio de fondo.
// Excluye `src/features/**` (REEMPLAZAR, `WEB-D164`).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features")];

function ficherosTsx(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (EXCLUIDOS.some((ex) => ruta.startsWith(ex))) continue;
    if (statSync(ruta).isDirectory()) {
      ficherosTsx(ruta, acumulado);
    } else if (entrada.endsWith(".tsx") && !entrada.endsWith(".test.tsx")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

/**
 * Excepción registrada y justificada, igual convención que
 * `tamano-componente.test.ts`: el reemplazo vive en el elemento padre,
 * no en el propio control, así que no puede aparecer en la misma cadena.
 */
const JUSTIFICADOS: Record<string, string> = {
  "ui/primitivas/field.tsx":
    "El <input> interior de la variante con prefijo/sufijo quita su contorno propio, pero el contenedor que lo envuelve declara `has-[input:focus]:ring-2` — el anillo sí aparece, solo que en la cadena de clases del padre, no en la del input.",
};

/** Cadenas de clases (entre comillas) que contienen `outline-none` sin un
 * reemplazo visible en la misma cadena. */
function cadenasSinReemplazo(contenido: string): string[] {
  const cadenas = contenido.match(/"[^"\n]*outline-none[^"\n]*"/g) ?? [];
  return cadenas.filter((cadena) => {
    const tieneAnillo = /\bring-/.test(cadena);
    const tieneOtroOutline = /\boutline(?!-none)\b/.test(cadena) || /\boutline-(?!none\b)/.test(cadena);
    const tieneCambioDeFondo = /\bfocus(?:-visible)?:bg-/.test(cadena);
    return !tieneAnillo && !tieneOtroOutline && !tieneCambioDeFondo;
  });
}

describe("AC-A11Y-02: outline-none siempre trae un reemplazo visible", () => {
  const ficheros = ficherosTsx(RAIZ_SRC, []);

  it("ninguna cadena de clases quita el contorno sin anillo, contorno o cambio de fondo", () => {
    const infractores = ficheros
      .map((f) => ({
        ruta: relative(RAIZ_SRC, f).split("\\").join("/"),
        sinReemplazo: cadenasSinReemplazo(readFileSync(f, "utf8")),
      }))
      .filter((f) => f.sinReemplazo.length > 0 && !JUSTIFICADOS[f.ruta]);
    expect(infractores).toEqual([]);
  });
});
