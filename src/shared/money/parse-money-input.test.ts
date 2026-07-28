import { describe, expect, it } from "vitest";
import { parseMoneyInput } from "./parse-money-input";

describe("parseMoneyInput (módulo único de moneda, AC-PAT-09, 17 §7)", () => {
  it("acepta un decimal simple", () => {
    expect(parseMoneyInput("1250.5")).toBe(1250.5);
  });

  it("acepta miles con coma y dos decimales", () => {
    expect(parseMoneyInput("1,250.50")).toBe(1250.5);
  });

  it("acepta el símbolo S/ pegado al monto", () => {
    expect(parseMoneyInput("S/1250.50")).toBe(1250.5);
  });

  it("acepta el símbolo S/ con espacio y miles", () => {
    expect(parseMoneyInput("S/ 1,250.50")).toBe(1250.5);
  });

  it("acepta un entero sin decimales", () => {
    expect(parseMoneyInput("1250")).toBe(1250);
  });

  it("acepta negativos", () => {
    expect(parseMoneyInput("-120.50")).toBe(-120.5);
  });

  it("redondea al céntimo", () => {
    expect(parseMoneyInput("10.999")).toBe(11);
  });

  it("rechaza texto que no es un monto", () => {
    expect(parseMoneyInput("no es un monto")).toBeNull();
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("S/")).toBeNull();
    expect(parseMoneyInput("12.34.56")).toBeNull();
  });
});
