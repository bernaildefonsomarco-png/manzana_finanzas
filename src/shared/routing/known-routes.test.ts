import { describe, expect, it } from "vitest";
import { isKnownInternalRoute } from "./known-routes";

describe("isKnownInternalRoute (10 §8, AC-NAV-07)", () => {
  it("acepta rutas internas conocidas", () => {
    expect(isKnownInternalRoute("/inicio")).toBe(true);
    expect(isKnownInternalRoute("/movimientos/nuevo")).toBe(true);
    expect(isKnownInternalRoute("/deudas?estado=activas")).toBe(true);
    expect(isKnownInternalRoute("/configuracion/perfil")).toBe(true);
  });

  it("rechaza URLs absolutas y protocolo-relativas", () => {
    expect(isKnownInternalRoute("https://evil.com")).toBe(false);
    expect(isKnownInternalRoute("http://evil.com/inicio")).toBe(false);
    expect(isKnownInternalRoute("//evil.com")).toBe(false);
    expect(isKnownInternalRoute("javascript:alert(1)")).toBe(false);
  });

  it("rechaza rutas que no están en el mapa de 10 §3.2", () => {
    expect(isKnownInternalRoute("/algo-inventado")).toBe(false);
    expect(isKnownInternalRoute("/")).toBe(false);
  });

  it("rechaza cadenas que no empiezan con /", () => {
    expect(isKnownInternalRoute("inicio")).toBe(false);
    expect(isKnownInternalRoute("")).toBe(false);
  });
});
