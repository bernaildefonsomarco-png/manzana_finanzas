import { describe, expect, it } from "vitest";
import { suggestSpelling } from "./spelling-suggestion";

describe("suggestSpelling (RUL-BUS-02, SCR-BUS-03)", () => {
  it("sugiere el comercio real más parecido a un typo", () => {
    expect(suggestSpelling("netflis", ["Netflix", "Spotify", "Uber"])).toBe("Netflix");
  });

  it("no sugiere nada si la palabra ya es exacta", () => {
    expect(suggestSpelling("Netflix", ["Netflix"])).toBeNull();
  });

  it("no sugiere nada si no hay comercios conocidos (nunca un diccionario general)", () => {
    expect(suggestSpelling("netflis", [])).toBeNull();
  });

  it("no sugiere algo completamente distinto", () => {
    expect(suggestSpelling("netflis", ["Farmacia Inkafarma"])).toBeNull();
  });
});
