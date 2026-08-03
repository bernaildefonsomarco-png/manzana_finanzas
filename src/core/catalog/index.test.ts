import { describe, expect, it } from "vitest";
import {
  censoCatalogo,
  comandosDelModulo,
  esComandoConocido,
  esComandoDeNivel,
  esDimensionConocida,
  esEntradaDeLecturaConocida,
  esMedidaConocida,
  medidaExigeAdvertencia,
  nivelesDeComando,
  obtenerComando,
} from "./index.ts";

describe("catálogo en tiempo de ejecución (AC-CATALOGO-10)", () => {
  it("reconoce un comando real del catálogo y rechaza uno inventado", () => {
    expect(esComandoConocido("crear_movimiento")).toBe(true);
    expect(esComandoConocido("borrar_todo_para_siempre")).toBe(false);
  });

  it("devuelve el/los niveles de confirmación reales de un comando", () => {
    expect(nivelesDeComando("crear_movimiento")).toEqual(["tarjeta_editable"]);
    expect(nivelesDeComando("eliminar_movimiento")).toEqual(["riesgo"]);
    expect(nivelesDeComando("no_existe")).toEqual([]);
  });

  it("un comando compuesto declara sus dos niveles (riesgo + masiva)", () => {
    expect(nivelesDeComando("fusionar_subcategorias")).toEqual(
      expect.arrayContaining(["riesgo", "masiva"]),
    );
  });

  it("esComandoDeNivel distingue por nivel exacto", () => {
    expect(esComandoDeNivel("crear_movimiento", "tarjeta_editable")).toBe(true);
    expect(esComandoDeNivel("crear_movimiento", "riesgo")).toBe(false);
  });

  it("obtenerComando devuelve el dueño y el detalle", () => {
    const comando = obtenerComando("ajustar_saldo");
    expect(comando?.dueño).toBe("24");
    expect(comando).not.toBeNull();
  });

  it("reconoce dimensiones y medidas reales del vocabulario abierto de lectura", () => {
    expect(esDimensionConocida("tipo_movimiento")).toBe(true);
    expect(esDimensionConocida("no_existe")).toBe(false);
    expect(esMedidaConocida("dinero_libre")).toBe(true);
    expect(esEntradaDeLecturaConocida("gasto_por_categoria")).toBe(true); // alias
    expect(esEntradaDeLecturaConocida("inventado")).toBe(false);
  });

  it("suma_propuesta, saldo_total_a_favor y proyeccion_cierre exigen advertencia; dinero_libre no", () => {
    expect(medidaExigeAdvertencia("suma_propuesta")).toBe(true);
    expect(medidaExigeAdvertencia("saldo_total_a_favor")).toBe(true);
    expect(medidaExigeAdvertencia("proyeccion_cierre")).toBe(true);
    expect(medidaExigeAdvertencia("dinero_libre")).toBe(false);
  });

  it("comandosDelModulo filtra por dueño real", () => {
    const de24 = comandosDelModulo("24");
    expect(de24.length).toBeGreaterThan(0);
    expect(de24.every((c) => c.dueño === "24")).toBe(true);
  });

  it("el censo expuesto coincide con el verificado en WEB-D254", () => {
    expect(censoCatalogo.totalComandos).toBe(99);
    expect(censoCatalogo.totalLecturas).toBe(156);
  });
});
