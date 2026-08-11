import { describe, expect, it } from "vitest";
import { CATALOGO_GENERADO } from "./generated";
import { esComandoConocido, nivelesDeComando } from "./index";
import {
  COMANDOS_EJECUTABLES_POR_EL_ASISTENTE,
  type ComandoEjecutable,
} from "./comandos-ejecutables";

const nombres = COMANDOS_EJECUTABLES_POR_EL_ASISTENTE.map((c) => c.nombre);

describe("censo de cobertura del asistente sobre el catalogo de `40` §7", () => {
  it("todo nombre del censo existe de verdad en el catalogo generado", () => {
    // Un rename en `40` tiene que romper aqui. Si el censo pudiera nombrar un
    // comando inexistente, el numero que se reporta seria inventado.
    const fuera = nombres.filter((nombre) => !esComandoConocido(nombre));
    expect(fuera).toEqual([]);
  });

  it("ningun comando aparece dos veces", () => {
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("cada entrada nombra el ejecutor concreto por el que pasa", () => {
    const sinVia = COMANDOS_EJECUTABLES_POR_EL_ASISTENTE.filter(
      (comando: ComandoEjecutable) => comando.via.trim().length === 0,
    );
    expect(sinVia).toEqual([]);
  });

  it("el asistente ejecuta 36 de los 99 comandos del catalogo", () => {
    // 30 antes de `RUL-LIG-01` + las 6 acciones ligeras de esta tanda. El
    // numero se afirma aqui a proposito: si alguien cablea o descablea un
    // comando sin tocar el censo, este test lo dice.
    expect(CATALOGO_GENERADO.censo.totalComandos).toBe(99);
    expect(nombres.length).toBe(36);
  });

  it("las seis acciones ligeras cableadas son todas de nivel `ninguna`", () => {
    const ligeras = [
      "posponer_recordatorio",
      "descartar_recordatorio",
      "descartar_descubrimiento",
      "marcar_descubrimiento",
      "ocultar_bloque_inicio",
      "mostrar_bloque_inicio",
    ];
    for (const nombre of ligeras) {
      expect(nombres).toContain(nombre);
      expect(nivelesDeComando(nombre)).toEqual(["ninguna"]);
    }
  });

  it("de los 12 comandos `ninguna` del catalogo, 8 estan cubiertos", () => {
    // Los 4 restantes se dejaron fuera a proposito y con motivo escrito en
    // `light-action-request.ts`: `posponer_siguiente` (mismo ejecutor que
    // `descartar_recordatorio`), `guardar_busqueda` y `guardar_vista_reporte`
    // (guardan configuracion de pantalla, que una conversacion no tiene) y
    // `confirmar_hecho_perfil`, que desde `AC-PERF-02` si tiene tool de lectura
    // (`get_profile_summary`) pero sigue fuera a proposito: promover un hecho
    // de perfil exige confirmacion del usuario y no la lectura del modelo
    // (`WEB-D023`). El motivo largo esta en `light-action-request.ts`.
    const ningunaEnCatalogo = CATALOGO_GENERADO.comandos
      .filter((comando) => comando.niveles.includes("ninguna"))
      .map((comando) => comando.nombre);
    expect(ningunaEnCatalogo).toHaveLength(12);

    const cubiertos = ningunaEnCatalogo.filter((nombre) =>
      nombres.includes(nombre),
    );
    expect(cubiertos.sort()).toEqual(
      [
        "descartar_descubrimiento",
        "descartar_recordatorio",
        "marcar_descubrimiento",
        "mostrar_bloque_inicio",
        "no_preguntar_mas",
        "ocultar_bloque_inicio",
        "posponer_recordatorio",
        "reactivar_aprendizaje",
      ].sort(),
    );
  });
});
