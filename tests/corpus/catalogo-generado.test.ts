// `src/core/catalog/generated.ts` es un artefacto generado
// (`npm run catalogo:generar`, `40` §2). Esta prueba falla el build si
// alguien lo edita a mano o si el corpus cambió sin regenerarlo — la misma
// garantía que `50` da a la matriz de trazabilidad.
import { describe, expect, it } from "vitest";
import { generarCatalogo } from "../../scripts/catalogo/generar.ts";
import { CATALOGO_GENERADO } from "../../src/core/catalog/generated.ts";

describe("src/core/catalog/generated.ts no está desincronizado del corpus", () => {
  it("una generación fresca produce exactamente el mismo censo que el archivo generado", () => {
    const fresco = generarCatalogo();
    expect(CATALOGO_GENERADO.censo).toEqual(fresco.censo);
  });

  it("una generación fresca produce exactamente los mismos datos que el archivo generado", () => {
    const fresco = generarCatalogo();
    expect(CATALOGO_GENERADO.dimensiones).toEqual(fresco.dimensiones);
    expect(CATALOGO_GENERADO.medidas).toEqual(fresco.medidas);
    expect(CATALOGO_GENERADO.alias).toEqual(fresco.alias);
    expect(CATALOGO_GENERADO.comandos).toEqual(fresco.comandos);
  });
});
