// Las 12 categorías canónicas tienen un único nombre visible: el que siembra
// `supabase/migrations/003_categories_tags.sql` en `categories.label` y que
// `src/shared/copy/category-copy.ts` replica para el código que compone texto
// sin ir a la base. Durante meses ese mapa estuvo copiado a mano en siete
// ficheros y las copias divergieron: la misma categoría se llamaba "Vivienda y
// hogar" en Reportes y "Vivienda / Hogar" en Movimientos. Esta regla existe
// para que la divergencia no pueda volver por la puerta de atrás: cualquier
// fichero que vuelva a escribir el mapa a mano falla aquí, aunque su copia
// nazca idéntica al canon (una copia idéntica hoy es la que diverge mañana).
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS } from "@/shared/copy/category-copy";
import { CATEGORY_IDS } from "@/shared/types/domain";

const RAIZ = process.cwd();
const RAIZ_SRC = join(RAIZ, "src");
const CANON = join(RAIZ_SRC, "shared", "copy", "category-copy.ts");
const SEED_CATEGORIAS = join(
  RAIZ,
  "supabase",
  "migrations",
  "003_categories_tags.sql"
);

// Un fichero "copia el mapa" cuando asocia varias categorías a un texto, sea
// como clave de objeto (`alimentacion: "Alimentación"`) o como par en una
// lista de opciones (`{ id: "alimentacion", label: "Alimentación" }`). Con
// cuatro ya no es una mención suelta: es el mapa otra vez.
const MINIMO_PARA_SER_UNA_COPIA = 4;

function patronesDeEtiqueta(categoryId: string): RegExp[] {
  return [
    new RegExp(`(?:^|[\\s{,(])${categoryId}\\s*:\\s*["'\`]`, "m"),
    new RegExp(`["']${categoryId}["']\\s*,\\s*label\\s*:\\s*["'\`]`),
    new RegExp(`label\\s*:\\s*["'\`][^"'\`]*["'\`]\\s*,\\s*id\\s*:\\s*["']${categoryId}["']`),
  ];
}

function ficherosFuente(directorio: string, acumulado: string[]): string[] {
  for (const entrada of readdirSync(directorio)) {
    const ruta = join(directorio, entrada);
    if (statSync(ruta).isDirectory()) {
      ficherosFuente(ruta, acumulado);
    } else if (/\.tsx?$/.test(entrada) && !/\.(test|spec)\.tsx?$/.test(entrada)) {
      acumulado.push(ruta);
    }
  }
  return acumulado;
}

function categoriasConEtiquetaLiteral(fuente: string): string[] {
  return CATEGORY_IDS.filter((categoryId) =>
    patronesDeEtiqueta(categoryId).some((patron) => patron.test(fuente))
  );
}

describe("las etiquetas de categoría se leen del canon, no de copias locales", () => {
  const ficheros = ficherosFuente(RAIZ_SRC, []).filter((f) => f !== CANON);

  it("hay ficheros que revisar", () => {
    expect(ficheros.length).toBeGreaterThan(100);
  });

  it("ningún fichero fuera de src/shared/copy/category-copy.ts reescribe el mapa", () => {
    const infractores = ficheros
      .filter(
        (fichero) =>
          categoriasConEtiquetaLiteral(readFileSync(fichero, "utf8")).length >=
          MINIMO_PARA_SER_UNA_COPIA
      )
      .map((fichero) => relative(RAIZ, fichero));

    expect(infractores).toEqual([]);
  });

  it("el canon dice exactamente lo que la migración siembra en categories.label", () => {
    const seed = readFileSync(SEED_CATEGORIAS, "utf8");
    const sembradas = new Map(
      [...seed.matchAll(/\(\s*'([a-z_]+)'\s*,\s*'([^']+)'\s*,/g)].map(
        (coincidencia) => [coincidencia[1], coincidencia[2]]
      )
    );

    for (const categoryId of CATEGORY_IDS) {
      expect(sembradas.get(categoryId), `falta el seed de ${categoryId}`).toBe(
        CATEGORY_LABELS[categoryId]
      );
    }
  });
});
