// `AC-DS-03` / `AC-A11Y-03` (`16` §3.1, `18` §5): todo par de tokens
// texto/fondo cumple el contraste WCAG AA en ambos modos — 4.5:1 para
// texto normal, 3:1 para elementos de interfaz y el indicador de foco.
// Se mide con la fórmula real de luminancia relativa (WCAG 2.x) sobre
// los valores hexadecimales que declara `src/app/globals.css`, no una
// aprobación visual: un cambio de token que rompa el contraste falla
// aquí antes de llegar a producción.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

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
    const match = linea.match(/^\s*(--[\w-]+)\s*:\s*(#[0-9a-fA-F]{6});\s*$/);
    if (match) propiedades[match[1]] = match[2];
  }
  return propiedades;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [R, G, B] = [r, g, b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

/** Fórmula de contraste de WCAG 2.x: `(L1+0.05)/(L2+0.05)`, con `L1` la
 * luminancia relativa mayor. Simétrica: el orden de los dos colores no
 * importa. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA));
  const lB = relativeLuminance(hexToRgb(hexB));
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

const TEXTO_MIN = 4.5;
const UI_MIN = 3.0;

// [nombre, token de texto, token de fondo, mínimo exigido]
const PARES: [string, string, string, number][] = [
  ["texto principal / fondo primario", "--color-text-primary", "--color-bg-primary", TEXTO_MIN],
  ["texto principal / superficie elevada", "--color-text-primary", "--color-bg-surface-raised", TEXTO_MIN],
  ["texto secundario / fondo primario", "--color-text-secondary", "--color-bg-primary", TEXTO_MIN],
  ["texto secundario / superficie elevada", "--color-text-secondary", "--color-bg-surface-raised", TEXTO_MIN],
  ["texto de marca / fondo primario", "--color-text-brand", "--color-bg-primary", TEXTO_MIN],
  ["texto invertido / fondo invertido", "--color-text-inverse", "--color-bg-inverse", TEXTO_MIN],
  ["success-on-subtle / success-subtle", "--color-success-on-subtle", "--color-success-subtle", TEXTO_MIN],
  ["warning-on-subtle / warning-subtle", "--color-warning-on-subtle", "--color-warning-subtle", TEXTO_MIN],
  ["error-on-subtle / error-subtle", "--color-error-on-subtle", "--color-error-subtle", TEXTO_MIN],
  ["info-on-subtle / info-subtle", "--color-info-on-subtle", "--color-info-subtle", TEXTO_MIN],
  ["debt / debt-subtle", "--color-debt", "--color-debt-subtle", TEXTO_MIN],
  ["borde de foco / superficie elevada", "--color-border-focus", "--color-bg-surface-raised", UI_MIN],
];

function verificarModo(nombreModo: string, tokens: Record<string, string>) {
  describe(`AC-DS-03: contraste en modo ${nombreModo}`, () => {
    for (const [nombre, tokenTexto, tokenFondo, minimo] of PARES) {
      it(`${nombre} cumple ${minimo}:1`, () => {
        const texto = tokens[tokenTexto];
        const fondo = tokens[tokenFondo];
        expect(texto, `falta ${tokenTexto} en modo ${nombreModo}`).toBeDefined();
        expect(fondo, `falta ${tokenFondo} en modo ${nombreModo}`).toBeDefined();
        expect(contrastRatio(texto, fondo)).toBeGreaterThanOrEqual(minimo);
      });
    }
  });
}

const claro = extraerBloque(CSS, /:root\s*\{/);
const oscuro = extraerBloque(CSS, /:root\[data-theme="dark"\]\s*\{/);
// El modo oscuro hereda del claro los tokens que no redeclara (p. ej.
// los que no tienen contraparte oscura porque no la necesitan); para
// medir el modo oscuro real se completan los que faltan con los claros.
const oscuroCompleto = { ...claro, ...oscuro };

verificarModo("claro", claro);
verificarModo("oscuro", oscuroCompleto);
