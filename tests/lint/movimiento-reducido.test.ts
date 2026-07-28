// `AC-A11Y-10` (`18` §6): se respeta `prefers-reduced-motion` — sin
// transiciones de posición ni animaciones de entrada cuando el usuario lo
// pide, en toda la app (una sola regla global, no por componente).
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const CSS = readFileSync(join(process.cwd(), "src", "app", "globals.css"), "utf8");

describe("AC-A11Y-10: prefers-reduced-motion se respeta globalmente", () => {
  it("existe un bloque @media (prefers-reduced-motion: reduce) que anula animación/transición", () => {
    const bloque = CSS.match(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/);
    expect(bloque).not.toBeNull();
    const cuerpo = bloque![1];
    expect(cuerpo).toMatch(/animation-duration:\s*0\.01ms/);
    expect(cuerpo).toMatch(/transition-duration:\s*0\.01ms/);
  });
});
