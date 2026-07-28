// AC-INV-04 (`52` §4.1, `21`, `WEB-D162`): ningún fichero de `src/core/`
// menciona un canal concreto, salvo las excepciones documentadas en
// `WEB-D170`, `WEB-D171` y `WEB-D172` (ver el gate para el porqué de cada
// una).
import { describe, expect, it } from "vitest";
import {
  FICHEROS_EXENTOS,
  verificarSinCanalEnElNucleo,
} from "../../scripts/gates/sin-canal-en-el-nucleo.ts";

describe("AC-INV-04: sin-canal-en-el-nucleo", () => {
  it("ningún fichero de src/core/ menciona whatsapp fuera de la excepción documentada", () => {
    const resultado = verificarSinCanalEnElNucleo();
    expect(resultado.sinJustificar).toEqual([]);
  });

  it("toda excepción documentada corresponde a un fichero que de verdad lo menciona", () => {
    const resultado = verificarSinCanalEnElNucleo();
    expect(resultado.entradasObsoletas).toEqual([]);
  });

  it("la lista de excepciones no tiene duplicados", () => {
    expect(new Set(FICHEROS_EXENTOS).size).toBe(FICHEROS_EXENTOS.length);
  });
});
