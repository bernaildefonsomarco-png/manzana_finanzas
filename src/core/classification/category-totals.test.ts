// RUL-CAT-11, AC-CAT-01, AC-CAT-06 (`25` §6, §7 tabla): las transferencias y
// asignaciones internas quedan fuera de cualquier total por categoría;
// sin_clasificar y otros nunca se mezclan.
import { describe, expect, it } from "vitest";
import { aggregateCategoryTotals, aggregateSubcategoryCounts } from "./category-totals";

describe("aggregateCategoryTotals", () => {
  it("AC-CAT-06: las transferencias y asignaciones internas no aparecen en el total", () => {
    const result = aggregateCategoryTotals([
      { type: "gasto", category_id: "alimentacion", amount: 30 },
      { type: "transferencia", category_id: null, amount: 100 },
      { type: "asignacion_interna", category_id: null, amount: 200 },
      { type: "ajuste", category_id: null, amount: 50 },
    ]);

    const alimentacion = result.find((r) => r.category_id === "alimentacion");
    expect(alimentacion?.total).toBe(30);
    // Ninguna fila de transferencia/asignacion_interna/ajuste generó grupo.
    expect(result).toHaveLength(1);
  });

  it("AC-CAT-01: sin_clasificar (category_id null) y 'otros' se agregan por separado", () => {
    const result = aggregateCategoryTotals([
      { type: "gasto", category_id: null, amount: 40 }, // sin_clasificar
      { type: "gasto", category_id: "otros", amount: 15 },
    ]);

    const sinClasificar = result.find((r) => r.category_id === null);
    const otros = result.find((r) => r.category_id === "otros");
    expect(sinClasificar?.total).toBe(40);
    expect(otros?.total).toBe(15);
    expect(result).toHaveLength(2);
  });

  it("suma varios movimientos de la misma categoria y cuenta correctamente", () => {
    const result = aggregateCategoryTotals([
      { type: "gasto", category_id: "transporte", amount: 12.5 },
      { type: "gasto", category_id: "transporte", amount: 8.5 },
      { type: "pago_recurrente", category_id: "transporte", amount: 20 },
    ]);

    expect(result).toEqual([
      { category_id: "transporte", total: 41, movement_count: 3 },
    ]);
  });

  it("ingreso y pago_deuda sí cuentan (RUL-CAT-11)", () => {
    const result = aggregateCategoryTotals([
      { type: "ingreso", category_id: "trabajo_productividad", amount: 100 },
      { type: "pago_deuda", category_id: "deudas", amount: 50 },
    ]);

    expect(result.find((r) => r.category_id === "trabajo_productividad")?.total).toBe(100);
    expect(result.find((r) => r.category_id === "deudas")?.total).toBe(50);
  });
});

describe("aggregateSubcategoryCounts", () => {
  it("cuenta movimientos por subcategoria, ignorando sin subcategoria", () => {
    const result = aggregateSubcategoryCounts([
      { type: "gasto", subcategory_id: "uber" },
      { type: "gasto", subcategory_id: "uber" },
      { type: "gasto", subcategory_id: "cafe" },
      { type: "gasto", subcategory_id: null },
    ]);

    expect(result).toEqual(
      expect.arrayContaining([
        { subcategory_id: "uber", movement_count: 2 },
        { subcategory_id: "cafe", movement_count: 1 },
      ])
    );
    expect(result).toHaveLength(2);
  });

  it("RUL-CAT-11: excluye transferencias y asignaciones internas del conteo", () => {
    const result = aggregateSubcategoryCounts([
      { type: "gasto", subcategory_id: "uber" },
      { type: "transferencia", subcategory_id: "uber" },
      { type: "asignacion_interna", subcategory_id: "uber" },
    ]);

    expect(result).toEqual([{ subcategory_id: "uber", movement_count: 1 }]);
  });
});
