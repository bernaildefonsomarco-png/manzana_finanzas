import { describe, expect, it } from "vitest";
import { isQuestionLikeQuery, parseSearchQuery, validateDateRange } from "./query-parser";

const NOW = new Date("2026-07-26T12:00:00Z");

describe("RUL-BUS-03: detección determinista de preguntas", () => {
  it.each([
    "¿cuánto llevo en comida?",
    "¿gasto más los fines de semana?",
    "compárame julio con junio",
    "cuanto gasté",
  ])("%s se detecta como pregunta", (query) => {
    expect(isQuestionLikeQuery(query)).toBe(true);
  });

  it.each(["netflix", "netflix julio", "comida en julio", "> 100"])(
    "%s se detecta como búsqueda, no pregunta",
    (query) => {
      expect(isQuestionLikeQuery(query)).toBe(false);
    },
  );
});

describe("parseSearchQuery", () => {
  it("una consulta que es pregunta no intenta parsear filtros (RUL-BUS-03)", () => {
    const result = parseSearchQuery("¿cuánto llevo en comida?", { now: NOW });
    expect(result.isQuestion).toBe(true);
  });

  it("reconoce un mes con año explícito", () => {
    const result = parseSearchQuery("comida julio 2026", { now: NOW });
    expect(result.dateRange).toEqual({ from: "2026-07-01", to: "2026-07-31", label: "Julio 2026" });
    expect(result.freeText).toBe("comida");
  });

  it("reconoce un mes sin año, asumiendo el año actual", () => {
    const result = parseSearchQuery("netflix julio", { now: NOW });
    expect(result.dateRange?.from).toBe("2026-07-01");
    expect(result.freeText).toBe("netflix");
  });

  it("reconoce montos con comparación", () => {
    expect(parseSearchQuery("> 100", { now: NOW }).amount).toEqual({ kind: "gt", amount: 100 });
    expect(parseSearchQuery("< 50", { now: NOW }).amount).toEqual({ kind: "lt", amount: 50 });
  });

  it("reconoce un monto exacto con o sin símbolo", () => {
    expect(parseSearchQuery("44.90", { now: NOW }).amount).toEqual({ kind: "exact", amount: 44.9 });
    expect(parseSearchQuery("S/44.90", { now: NOW }).amount).toEqual({ kind: "exact", amount: 44.9 });
  });

  it("reconoce 'ayer' y 'esta semana' relativos a la fecha de referencia", () => {
    expect(parseSearchQuery("ayer", { now: NOW }).dateRange).toEqual({
      from: "2026-07-25",
      to: "2026-07-25",
      label: "Ayer",
    });
    const week = parseSearchQuery("esta semana", { now: NOW }).dateRange;
    expect(week?.from).toBe("2026-07-20"); // lunes de esa semana
    expect(week?.to).toBe("2026-07-26"); // domingo
  });

  it("reconoce un rango explícito dd/mm - dd/mm", () => {
    const result = parseSearchQuery("1/7 - 15/7", { now: NOW });
    expect(result.dateRange).toEqual({ from: "2026-07-01", to: "2026-07-15", label: "1/7 al 15/7" });
  });

  it("combina texto libre, categoría textual y fecha en la misma consulta", () => {
    const result = parseSearchQuery("comida julio > 50", { now: NOW });
    expect(result.freeText).toBe("comida");
    expect(result.amount).toEqual({ kind: "gt", amount: 50 });
    expect(result.dateRange?.label).toBe("Julio 2026");
  });

  it("una consulta vacía o solo espacios se trata como vacía (RUL-BUS-09)", () => {
    expect(parseSearchQuery("   ", { now: NOW })).toEqual({
      freeText: "",
      amount: null,
      dateRange: null,
      isQuestion: false,
    });
  });

  it("recorta a 200 caracteres en vez de rechazar", () => {
    const result = parseSearchQuery("x".repeat(500), { now: NOW });
    expect(result.freeText.length).toBeLessThanOrEqual(200);
  });

  it("elimina caracteres de control antes de parsear", () => {
    const result = parseSearchQuery("netflix\x00\x1f", { now: NOW });
    expect(result.freeText).toBe("netflix");
  });
});

describe("validateDateRange (ERR-BUS-01/02)", () => {
  it("rechaza un rango con fin antes que inicio", () => {
    expect(validateDateRange("2026-07-10", "2026-07-01")).toEqual({
      valid: false,
      error: "invalid_order",
    });
  });

  it("rechaza un rango mayor a 366 días", () => {
    expect(validateDateRange("2025-01-01", "2026-06-01")).toEqual({
      valid: false,
      error: "range_too_long",
    });
  });

  it("acepta un rango de exactamente 366 días", () => {
    expect(validateDateRange("2024-01-01", "2025-01-01")).toEqual({ valid: true });
  });
});
