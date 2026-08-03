// Pruebas de clase `corpus` sobre el generador del catálogo de comandos y
// vocabulario (`40` §2, `W-16`). Leen `documentacion/app_web/` a través del
// generador; no tocan `src/` ni necesitan red ni base de datos
// (`AC-PRUEBA-10`).
import { describe, expect, it } from "vitest";
import { generarCatalogo } from "../../scripts/catalogo/generar.ts";

describe("generador del catálogo de comandos y vocabulario", () => {
  const catalogo = generarCatalogo();

  it("AC-CATALOGO-01: ninguna dimensión/medida/comando de un módulo falta en 40, y viceversa", () => {
    expect(catalogo.sincronizacion.faltanEnCatalogo).toEqual([]);
    expect(catalogo.sincronizacion.faltanEnModulos).toEqual([]);
  });

  it("las tablas de 40 se parsean sin error de forma", () => {
    expect(catalogo.errores).toEqual([]);
  });

  it("WEB-D254: el censo verificado es 99 comandos y 156 entradas de lectura (101+50+5)", () => {
    expect(catalogo.censo.totalComandos).toBe(99);
    expect(catalogo.censo.totalDimensiones).toBe(101);
    expect(catalogo.censo.totalMedidas).toBe(50);
    expect(catalogo.censo.totalAlias).toBe(5);
    expect(catalogo.censo.totalLecturas).toBe(156);
  });

  it("40 §7.17: reparto por nivel de confirmación", () => {
    expect(catalogo.censo.porNivel).toEqual({
      ninguna: 12,
      tarjeta: 40,
      tarjeta_editable: 28,
      riesgo: 13,
      masiva: 8,
      consentimiento: 1,
    });
  });

  it("AC-CATALOGO-03: ninguna dimensión ni medida tiene el mismo nombre con distinto dueño", () => {
    const porNombre = new Map<string, Set<string>>();
    for (const entrada of [...catalogo.dimensiones, ...catalogo.medidas]) {
      const dueños = porNombre.get(entrada.nombre) ?? new Set<string>();
      dueños.add(entrada.dueño);
      porNombre.set(entrada.nombre, dueños);
    }
    const colisiones = [...porNombre.entries()].filter(([, dueños]) => dueños.size > 1);
    expect(colisiones).toEqual([]);
  });

  it("AC-CATALOGO-03: ningún nombre de comando se repite con distinto dueño", () => {
    const porNombre = new Map<string, Set<string>>();
    for (const comando of catalogo.comandos) {
      const dueños = porNombre.get(comando.nombre) ?? new Set<string>();
      dueños.add(comando.dueño);
      porNombre.set(comando.nombre, dueños);
    }
    const colisiones = [...porNombre.entries()].filter(([, dueños]) => dueños.size > 1);
    expect(colisiones).toEqual([]);
  });

  it("RUL-CATALOGO-01: ninguna dimensión usa un nombre desnudo prohibido (tipo, estado, origen, periodo, frecuencia, conteo)", () => {
    const prohibidos = new Set(["tipo", "estado", "origen", "periodo", "frecuencia", "conteo"]);
    const desnudos = catalogo.dimensiones.filter((d) => prohibidos.has(d.nombre));
    expect(desnudos).toEqual([]);
  });

  it("AC-CATALOGO-04: ningún comando de nivel 'ninguna' pertenece a un módulo que mueve dinero", () => {
    // 24 (cuentas/cajas), 26 (movimientos), 30 (compromisos), 31 (deudas) y
    // 32 (presupuestos/metas) son los módulos cuyo catálogo toca saldos; RUL
    // dura: ninguno de sus comandos puede tener nivel `ninguna`.
    const modulosFinancieros = new Set(["24", "26", "30", "31", "32"]);
    const infractores = catalogo.comandos.filter(
      (c) => c.niveles.includes("ninguna") && modulosFinancieros.has(c.dueño),
    );
    expect(infractores).toEqual([]);
  });

  it("AC-CATALOGO-08: suma_propuesta, saldo_total_a_favor y proyeccion_cierre llevan advertencia", () => {
    const conAdvertencia = catalogo.medidas.filter((m) => m.advertencia).map((m) => m.nombre).sort();
    expect(conAdvertencia).toEqual(["proyeccion_cierre", "saldo_total_a_favor", "suma_propuesta"]);
  });

  it("los alias declaran de qué medida agrupada vienen (RUL-CATALOGO-04)", () => {
    expect(catalogo.alias.length).toBeGreaterThan(0);
    for (const alias of catalogo.alias) {
      expect(alias.equivaleA.length).toBeGreaterThan(0);
    }
  });
});
