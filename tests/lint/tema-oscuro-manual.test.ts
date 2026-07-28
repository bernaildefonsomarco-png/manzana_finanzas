// `AC-DS-02` (`16` §3.1): el bloque `@media (prefers-color-scheme: dark)` y
// el bloque `:root[data-theme="dark"]` de `src/app/globals.css` deben
// declarar exactamente las mismas propiedades con exactamente los mismos
// valores — son el mismo modo oscuro, uno activado por el sistema y otro
// forzado manualmente (`WEB-D` tema manual, `18` §3.1). Si divergen, alguien
// cambió un valor en un bloque y olvidó el otro.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(
  join(process.cwd(), "src", "app", "globals.css"),
  "utf8",
);

function extraerBloque(css: string, aperturaSelector: RegExp): Record<string, string> {
  const inicio = css.search(aperturaSelector);
  if (inicio === -1) throw new Error("selector no encontrado en globals.css");
  const desdeLlave = css.indexOf("{", inicio);
  let profundidad = 1;
  let i = desdeLlave + 1;
  while (profundidad > 0) {
    if (css[i] === "{") profundidad++;
    if (css[i] === "}") profundidad--;
    i++;
  }
  const cuerpo = css.slice(desdeLlave + 1, i - 1);
  const propiedades: Record<string, string> = {};
  for (const linea of cuerpo.split("\n")) {
    const match = linea.match(/^\s*(--[\w-]+)\s*:\s*(.+?);\s*$/);
    if (match) propiedades[match[1]] = match[2].trim();
  }
  return propiedades;
}

describe("AC-DS-02: el modo oscuro del sistema y el forzado manualmente coinciden", () => {
  it("declaran exactamente las mismas variables con los mismos valores", () => {
    const delSistema = extraerBloque(
      CSS,
      /:root:not\(\[data-theme="light"\]\)\s*\{/,
    );
    const delManual = extraerBloque(CSS, /:root\[data-theme="dark"\]\s*\{/);

    expect(Object.keys(delManual).sort()).toEqual(Object.keys(delSistema).sort());
    expect(delManual).toEqual(delSistema);
  });
});
