import { describe, expect, it } from "vitest";
import { capaDelHecho, esSubjectKeyDePerfilValido, PROFILE_LAYERS } from "./layers";

describe("capaDelHecho (20c S2)", () => {
  it.each([
    ["estilo:longitud", "estilo"],
    ["vida:trabajo", "vida"],
    ["vinculo:preocupacion_principal", "vinculo"],
    ["hilo:tema_abierto", "hilo"],
  ] as const)("reconoce la capa de \"%s\"", (subjectKey, capaEsperada) => {
    expect(capaDelHecho(subjectKey)).toBe(capaEsperada);
  });

  it("devuelve null para un subject_key de otro ambito de memoria (36 S4.1)", () => {
    expect(capaDelHecho("comercio:Rappi")).toBeNull();
  });

  it("devuelve null para un prefijo que no es ninguna de las cuatro capas", () => {
    expect(capaDelHecho("signo_zodiacal:leo")).toBeNull();
  });

  it("devuelve null para un subject_key mal formado", () => {
    expect(capaDelHecho("vida")).toBeNull();
    expect(capaDelHecho("vida:")).toBeNull();
    expect(capaDelHecho("")).toBeNull();
  });

  it("las cuatro capas de 20c S2 son exactamente estas cuatro", () => {
    expect(PROFILE_LAYERS).toEqual(["estilo", "vida", "vinculo", "hilo"]);
  });
});

describe("esSubjectKeyDePerfilValido", () => {
  it("acepta un subject_key con capa real", () => {
    expect(esSubjectKeyDePerfilValido("vida:trabajo")).toBe(true);
  });

  it("rechaza un subject_key sin capa de perfil", () => {
    expect(esSubjectKeyDePerfilValido("comercio:Rappi")).toBe(false);
  });
});
