import { describe, expect, it } from "vitest";
import { CATEGORY_LABELS, getCategoryLabel } from "./category-copy";
import { CATEGORY_IDS } from "@/shared/types/domain";

describe("etiquetas de categoria visibles", () => {
  it("las 12 categorias canonicas tienen etiqueta y ninguna repite el slug", () => {
    for (const categoryId of CATEGORY_IDS) {
      const label = CATEGORY_LABELS[categoryId];
      expect(label, `falta etiqueta para ${categoryId}`).toBeTruthy();
      expect(label).not.toBe(categoryId);
      expect(label).not.toContain("_");
    }
  });

  it("resuelve el id a la etiqueta que la persona ve en la app", () => {
    expect(getCategoryLabel("vivienda_hogar")).toBe("Vivienda / Hogar");
    expect(getCategoryLabel("servicios_suscripciones")).toBe(
      "Servicios / Suscripciones"
    );
  });

  it("un id desconocido se suaviza en vez de filtrar el slug crudo", () => {
    expect(getCategoryLabel("categoria_retirada")).toBe("Categoria retirada");
  });

  it("sin categoria no inventa texto", () => {
    expect(getCategoryLabel(null)).toBeNull();
    expect(getCategoryLabel(undefined)).toBeNull();
    expect(getCategoryLabel("")).toBeNull();
  });
});
