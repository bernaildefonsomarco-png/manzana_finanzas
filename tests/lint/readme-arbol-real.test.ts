// `AC-DEUDA-04` / `AC-INV-08` (53 §4): el README describe el árbol real de
// `src/`, en las dos direcciones — nada que el README documenta debería
// existir y no existe, y ninguna carpeta real de segundo nivel bajo `src/`
// queda sin mencionar. Las ocho afirmaciones falsas que este test cierra
// están listadas en `53_deuda_tecnica_y_saneamiento.md` §4.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const RAIZ = process.cwd();
const README = readFileSync(join(RAIZ, "README.md"), "utf8");

function subdirectorios(ruta: string): string[] {
  return readdirSync(join(RAIZ, ruta))
    .filter((entrada) => statSync(join(RAIZ, ruta, entrada)).isDirectory());
}

describe("53 §4: las ocho afirmaciones falsas del README, corregidas", () => {
  it("core/commands, core/engines y core/validators ya no se listan como si tuvieran código", () => {
    expect(README).not.toMatch(/onboarding\/, disclosure\/, risk\/, events\/, commands\/, engines\/, validators\//);
    expect(README).toMatch(/commands\/, engines\/, validators\/.*vacías/);
  });

  it("workers/pending, workers/recurring, workers/insights y workers/email ya no aparecen: se borraron", () => {
    expect(README).not.toMatch(/workers\/pending\//);
    expect(README).not.toMatch(/workers\/recurring\//);
    expect(README).not.toMatch(/workers\/insights\//);
    expect(README).not.toMatch(/workers\/email\//);
  });

  it("adapters/whatsapp/ ya no dice 'sin implementación aún'", () => {
    expect(README).not.toMatch(/whatsapp\/\s*#\s*WhatsAppAdapter \(reservado; sin implementaci[oó]n a[uú]n\)/);
    expect(README).toMatch(/whatsapp\/.*implementado.*2[.,]639 l[ií]neas/);
  });

  it("src/app/(dashboard)/ no se documenta: la carpeta no existe", () => {
    expect(README).not.toContain("(dashboard)/");
  });

  it("la migración deja de describir dos árboles: supabase/migrations/ es la única rama", () => {
    expect(README).not.toMatch(/espejo sincronizado/);
    expect(README).toMatch(/única rama de migraciones/);
  });
});

describe("AC-DEUDA-04: el README describe el árbol real, en las dos direcciones", () => {
  const areasDocumentadas = ["app", "core", "adapters", "agents", "workers", "shared", "data"];

  it.each(areasDocumentadas)("toda carpeta real de segundo nivel bajo src/%s se menciona en el README", (area) => {
    const faltantes = subdirectorios(join("src", area)).filter(
      (nombre) => !README.includes(`${nombre}/`)
    );
    expect(faltantes).toEqual([]);
  });

});
