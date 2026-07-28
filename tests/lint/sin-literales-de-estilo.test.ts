// `AC-DS-01` (`16` §2, `51` §6.4 `sin-literales-de-estilo`): ningún
// componente escribe un color, espaciado o radio literal — todos usan los
// tokens de `src/app/globals.css`. Activa desde `W-06` (`WEB-D169`: no
// podía definirse antes porque no existía la paleta de tokens que la
// regla necesita comparar). Excluye `src/features/**` (REEMPLAZAR,
// `WEB-D164`): esas 11.683 líneas ya tienen literales conocidos y no se
// arreglan — desaparecen con sus ficheros.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ_SRC = join(process.cwd(), "src");
const EXCLUIDOS = [join(RAIZ_SRC, "features")];

// Paleta por defecto de Tailwind: si aparece con un matiz numérico tras un
// prefijo que pinta color, es un literal — el sistema de diseño solo
// nombra sus propios tokens (`bg-error`, `text-brand`, nunca `bg-red-500`).
const FAMILIAS_TAILWIND = [
  "red", "orange", "amber", "yellow", "lime", "green", "emerald", "teal",
  "cyan", "sky", "blue", "indigo", "violet", "purple", "fuchsia", "pink",
  "rose", "slate", "gray", "zinc", "neutral", "stone",
];
const PREFIJOS_COLOR = [
  "bg", "text", "border", "ring", "fill", "stroke", "shadow", "outline",
  "from", "via", "to", "decoration", "accent", "caret", "divide",
];
const PATRON_PALETA_LITERAL = new RegExp(
  `\\b(?:${PREFIJOS_COLOR.join("|")})-(?:${FAMILIAS_TAILWIND.join("|")})-\\d{2,3}\\b`
);

// Sintaxis de valor arbitrario de Tailwind (`p-[13px]`, `bg-[#fff]`,
// `rounded-[7px]`): siempre un literal, tokens no se escriben entre
// corchetes.
const PATRON_VALOR_ARBITRARIO =
  /\b(?:bg|text|border|ring|fill|stroke|shadow|outline|from|via|to|decoration|accent|caret|divide|rounded|p|px|py|pt|pr|pb|pl|m|mx|my|mt|mr|mb|ml|gap|gap-x|gap-y)-\[[^\]]+\]/;

// Un color hexadecimal o un tamaño en `px`/`rem` literal dentro de un
// objeto `style` en línea — el valor dinámico legítimo (p. ej. el ancho
// de una barra de progreso) nunca lleva un color ni una unidad fija de
// diseño, solo un porcentaje o variable calculada. Los bloques `style`
// se extraen primero hasta el `}}` real (no greedy) porque una plantilla
// como `` `${ratio * 100}%` `` contiene una `}` suelta que un patrón
// `[^}]*` cortaría antes de tiempo.
const PATRON_BLOQUE_ESTILO = /style=\{\{[\s\S]*?\}\}/g;
const PATRON_LITERAL_EN_BLOQUE =
  /(#[0-9a-fA-F]{3,8})|(?:padding|margin|borderRadius|color)\s*:\s*["'`]?\d/;

function tieneEstiloLiteral(contenido: string): boolean {
  const bloques = contenido.match(PATRON_BLOQUE_ESTILO) ?? [];
  return bloques.some((bloque) => PATRON_LITERAL_EN_BLOQUE.test(bloque));
}

// Solo `.tsx`: las clases de Tailwind y los `style` en línea viven en JSX.
// Un `.ts` de lógica de negocio puede contener texto que coincide por
// casualidad con la sintaxis de valor arbitrario (p. ej. un identificador
// `m-[a-f0-9]{6,8}` en una expresión regular) sin ser jamás una clase.
function ficherosFuente(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (EXCLUIDOS.some((ex) => ruta.startsWith(ex))) continue;
    if (statSync(ruta).isDirectory()) {
      ficherosFuente(ruta, acumulado);
    } else if (entrada.endsWith(".tsx") && !entrada.endsWith(".test.tsx")) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

describe("AC-DS-01 (sin-literales-de-estilo): ningún color/espaciado/radio literal fuera de tokens", () => {
  const ficheros = ficherosFuente(RAIZ_SRC, []);

  it("ningún fichero usa un color de la paleta por defecto de Tailwind", () => {
    const infractores = ficheros.filter((f) => PATRON_PALETA_LITERAL.test(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });

  it("ningún fichero usa sintaxis de valor arbitrario para color/espaciado/radio", () => {
    const infractores = ficheros.filter((f) => PATRON_VALOR_ARBITRARIO.test(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });

  it("ningún fichero declara un color o tamaño literal en un `style` en línea", () => {
    const infractores = ficheros.filter((f) => tieneEstiloLiteral(readFileSync(f, "utf8")));
    expect(infractores.map((f) => relative(RAIZ_SRC, f))).toEqual([]);
  });
});
