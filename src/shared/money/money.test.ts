import { describe, it, expect } from "vitest";
import { toCents, fromCents, formatMoney, addMoney, subtractMoney, pen } from "./index";

describe("money utils", () => {
  describe("toCents", () => {
    it("convierte soles a centavos correctamente", () => {
      expect(toCents(12.5)).toBe(1250);
      expect(toCents(1)).toBe(100);
      expect(toCents(0)).toBe(0);
      expect(toCents(100.99)).toBe(10099);
    });

    it("redondea correctamente valores con muchos decimales", () => {
      expect(toCents(12.505)).toBe(1251);
      expect(toCents(12.504)).toBe(1250);
    });
  });

  describe("fromCents", () => {
    it("convierte centavos a soles correctamente", () => {
      expect(fromCents(1250)).toBe(12.5);
      expect(fromCents(100)).toBe(1);
      expect(fromCents(0)).toBe(0);
    });
  });

  describe("formatMoney", () => {
    it("formatea con prefijo S/ por defecto", () => {
      expect(formatMoney(1250)).toBe("S/12.50");
      expect(formatMoney(100)).toBe("S/1.00");
    });

    it("omite decimales cuando showDecimals=false y es entero", () => {
      expect(formatMoney(100, { showDecimals: false })).toBe("S/1");
      expect(formatMoney(1250, { showDecimals: false })).toBe("S/12.50");
    });

    it("omite simbolo de moneda cuando showCurrencySymbol=false", () => {
      expect(formatMoney(1250, { showCurrencySymbol: false })).toBe("12.50");
    });
  });

  describe("addMoney", () => {
    it("suma dos montos de la misma moneda", () => {
      const result = addMoney(pen(1000), pen(500));
      expect(result).toEqual({ amount: 1500, currency: "PEN" });
    });

    it("lanza error si las monedas son distintas", () => {
      expect(() =>
        addMoney(
          { amount: 1000, currency: "PEN" },
          { amount: 500, currency: "USD" }
        )
      ).toThrow();
    });
  });

  describe("subtractMoney", () => {
    it("resta dos montos de la misma moneda", () => {
      const result = subtractMoney(pen(1000), pen(300));
      expect(result).toEqual({ amount: 700, currency: "PEN" });
    });

    it("puede devolver un resultado negativo (deficit)", () => {
      const result = subtractMoney(pen(100), pen(500));
      expect(result.amount).toBe(-400);
    });
  });
});
