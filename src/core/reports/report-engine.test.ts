import { describe, expect, it } from "vitest";
import {
  applicableCharts,
  compareReportPeriods,
  computeReportPeriod,
  resolveReportPeriodBounds,
  topCategoriesWithOthers,
  type ReportMovement,
} from "./report-engine";

function movement(overrides: Partial<ReportMovement> & { id: string }): ReportMovement {
  return {
    type: "gasto",
    status: "confirmed",
    amount: 0,
    currency: "PEN",
    category_id: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("computeReportPeriod", () => {
  it("RUL-REP-01: agrupa el gasto por categoría con el mismo total que Presupuestos (63 movimientos, ejemplo del documento)", () => {
    const result = computeReportPeriod({
      movements: [
        movement({ id: "1", type: "gasto", category_id: "alimentacion", amount: 200 }),
        movement({ id: "2", type: "gasto", category_id: "alimentacion", amount: 118 }),
        movement({
          id: "3",
          type: "pago_deuda",
          category_id: "deudas",
          amount: 100,
        }),
      ],
    });
    expect(result.byCategory.find((c) => c.category_id === "alimentacion")?.total).toBe(318);
    expect(result.byCategory.find((c) => c.category_id === "deudas")?.total).toBe(100);
    expect(result.gastoTotal).toBe(418);
  });

  it("RUL-REP-02: declara lo que dejó fuera y por qué", () => {
    const result = computeReportPeriod({
      movements: [
        movement({ id: "1", type: "gasto", amount: 50 }),
        movement({ id: "2", type: "transferencia", amount: 100 }),
        movement({ id: "3", type: "transferencia", amount: 40 }),
        movement({ id: "4", type: "asignacion_interna", amount: 30 }),
        movement({ id: "5", type: "ajuste", amount: -10 }),
      ],
      pendingUnconfirmedCount: 3,
    });
    const byReason = Object.fromEntries(result.exclusions.map((e) => [e.reason, e.count]));
    expect(byReason.transferencia).toBe(2);
    expect(byReason.asignacion_interna).toBe(1);
    expect(byReason.ajuste).toBe(1);
    expect(byReason.pendiente_sin_confirmar).toBe(3);
  });

  it("ingreso se agrega aparte del gasto, en su propio total", () => {
    const result = computeReportPeriod({
      movements: [
        movement({ id: "1", type: "gasto", amount: 100 }),
        movement({ id: "2", type: "ingreso", amount: 2400 }),
      ],
    });
    expect(result.gastoTotal).toBe(100);
    expect(result.ingresoTotal).toBe(2400);
  });

  it("movimientos eliminados o en otra moneda no cuentan", () => {
    const result = computeReportPeriod({
      movements: [
        movement({ id: "1", type: "gasto", amount: 100, deleted_at: "2026-08-01T00:00:00Z" }),
        movement({ id: "2", type: "gasto", amount: 100, currency: "USD" }),
      ],
    });
    expect(result.gastoTotal).toBe(0);
    expect(result.exclusions.find((e) => e.reason === "otra_moneda")?.count).toBe(1);
  });

  it("pago_deuda solo cuenta si su categoría es 'deudas' (mismo contrato que Presupuestos)", () => {
    const result = computeReportPeriod({
      movements: [movement({ id: "1", type: "pago_deuda", category_id: "otros", amount: 100 })],
    });
    expect(result.gastoTotal).toBe(0);
  });
});

describe("compareReportPeriods", () => {
  it("RUL-REP-04: no normaliza por longitud de periodo, solo resta", () => {
    const julio = computeReportPeriod({
      movements: [movement({ id: "1", type: "gasto", category_id: "transporte", amount: 230 })],
    });
    const junio = computeReportPeriod({
      movements: [movement({ id: "2", type: "gasto", category_id: "transporte", amount: 188 })],
    });
    const comparison = compareReportPeriods(julio, junio);
    expect(comparison.differenceAbsolute).toBe(42);
    const transporte = comparison.byCategory.find((c) => c.category_id === "transporte");
    expect(transporte?.differenceAbsolute).toBe(42);
  });
});

describe("applicableCharts (RUL-REP-05)", () => {
  it("el gráfico de ingreso contra gasto no aparece si no hay ingresos", () => {
    const charts = applicableCharts({
      hasComparison: false,
      hasIngresos: false,
      hasMultipleAccounts: false,
      hasSeveralPeriodsForEvolution: false,
    });
    expect(charts).not.toContain("ingreso_vs_gasto");
    expect(charts).toContain("barras_categoria");
  });

  it("nunca hay un sexto gráfico", () => {
    const charts = applicableCharts({
      hasComparison: true,
      hasIngresos: true,
      hasMultipleAccounts: true,
      hasSeveralPeriodsForEvolution: true,
    });
    expect(charts.length).toBeLessThanOrEqual(5);
  });
});

describe("resolveReportPeriodBounds (RUL-REP-03)", () => {
  it("mes: primer y último día del mes", () => {
    expect(resolveReportPeriodBounds("mes", "2026-07")).toEqual({ from: "2026-07-01", to: "2026-07-31" });
    expect(resolveReportPeriodBounds("mes", "2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
  });

  it("quincena: del 1 al 15, y del 16 al último día", () => {
    expect(resolveReportPeriodBounds("quincena", "2026-07-1")).toEqual({ from: "2026-07-01", to: "2026-07-15" });
    expect(resolveReportPeriodBounds("quincena", "2026-07-2")).toEqual({ from: "2026-07-16", to: "2026-07-31" });
  });

  it("semana: lunes a domingo de la fecha dada", () => {
    expect(resolveReportPeriodBounds("semana", "2026-07-15")).toEqual({ from: "2026-07-13", to: "2026-07-19" });
  });

  it("rango: usa desde/hasta explícitos", () => {
    expect(resolveReportPeriodBounds("rango", "2026-07-01", "2026-07-20")).toEqual({
      from: "2026-07-01",
      to: "2026-07-20",
    });
  });
});

describe("topCategoriesWithOthers", () => {
  it("nunca más de 5 barras: el resto se agrupa en Otras", () => {
    const categories = Array.from({ length: 7 }, (_, i) => ({
      category_id: `cat_${i}` as never,
      total: 100 - i,
      movement_count: 1,
    }));
    const { top, othersTotal, othersCount } = topCategoriesWithOthers(categories);
    expect(top).toHaveLength(5);
    expect(othersCount).toBe(2);
    expect(othersTotal).toBe(95 + 94);
  });
});
