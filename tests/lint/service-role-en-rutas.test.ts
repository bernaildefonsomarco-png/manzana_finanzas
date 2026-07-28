// `AC-SEG-01` (`15` §5, `53` D-02, `WEB-D168`): ninguna ruta de `src/app/api/`
// importa `createServiceClient` sin justificación registrada. Este test es
// el que corre en `npm test`; el mismo gate corre tambien en `prebuild`
// (51 §7: los seis — ahora siete — que fallan el build, no solo la suite).
import { describe, expect, it } from "vitest";
import { verificarServiceRoleEnRutas } from "../../scripts/gates/service-role-en-rutas.ts";
import { EXCEPCIONES_TEMPORALES, LISTA_BLANCA_PERMANENTE } from "../../scripts/gates/service-role-lista.ts";

describe("AC-SEG-01: service-role solo con justificación registrada", () => {
  it("toda ruta que usa createServiceClient está en una de las dos listas, y ninguna excepción temporal es obsoleta", () => {
    const resultado = verificarServiceRoleEnRutas();
    expect(resultado.sinJustificar).toEqual([]);
    expect(resultado.entradasObsoletas).toEqual([]);
  });

  it("la lista de excepciones temporales tiene 46 rutas: las 48 de 15 §1 menos las dos que 15 §4 ya declaraba permanentes", () => {
    // /api/v1/onboarding y /api/v1/privacy/account están entre las 48 que
    // 15 §1 mide como "usan createServiceClient", pero 15 §4 ya las
    // justifica como categoría permanente (registro sin sesión completa,
    // borrado de todas las tablas). No son pendientes de migrar: no
    // deberían estar en la lista que AC-SEG-07 quiere vaciar.
    expect(EXCEPCIONES_TEMPORALES.length).toBe(46);
  });

  it("AC-SEG-07 (agregado): la lista temporal no está vacía todavía — no cierra en W-02 (WEB-D168)", () => {
    // Este test documenta el estado, no lo exige en verde-vacio: AC-SEG-07
    // cierra cuando la ultima ruta sale de EXCEPCIONES_TEMPORALES, en el
    // corte que la migre. Si algún día está vacía, esta prueba lo veria y
    // habria que promover AC-SEG-07 a verificado en la matriz.
    expect(EXCEPCIONES_TEMPORALES.length).toBeGreaterThan(0);
  });

  it("las dos listas no se solapan: ninguna ruta aparece dos veces", () => {
    const patrones = [...LISTA_BLANCA_PERMANENTE, ...EXCEPCIONES_TEMPORALES].map((e) => e.patron);
    expect(new Set(patrones).size).toBe(patrones.length);
  });

  it("toda entrada de las dos listas declara una justificación no vacía", () => {
    for (const entrada of [...LISTA_BLANCA_PERMANENTE, ...EXCEPCIONES_TEMPORALES]) {
      expect(entrada.justificacion.length).toBeGreaterThan(10);
    }
  });
});
