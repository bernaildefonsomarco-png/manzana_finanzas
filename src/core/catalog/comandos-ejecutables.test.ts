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

  it("el asistente ejecuta 40 de los 99 comandos del catalogo", () => {
    // 30 antes de `RUL-LIG-01`, + las 6 acciones ligeras, + las 4 preferencias
    // de aviso de `RUL-PREF-01`. El numero se afirma aqui a proposito: si
    // alguien cablea o descablea un comando sin tocar el censo, este test lo
    // dice.
    expect(CATALOGO_GENERADO.censo.totalComandos).toBe(99);
    expect(nombres.length).toBe(40);
  });

  it("las cuatro preferencias cableadas llevan el nivel que dice el catalogo", () => {
    // `RUL-PREF-01` no elige el nivel: lo lee. Tres son `tarjeta` y la del
    // correo es `consentimiento`, que es su propio nivel (`40` §3) y por eso
    // exige mas certeza y deja constancia. Si `40` reclasificara alguno, este
    // test lo dice antes de que el asistente ejecute con el nivel equivocado.
    expect(nivelesDeComando("pausar_recordatorios")).toEqual(["tarjeta"]);
    expect(nivelesDeComando("silenciar_tipo_recordatorio")).toEqual(["tarjeta"]);
    expect(nivelesDeComando("cambiar_horario_silencioso")).toEqual(["tarjeta"]);
    expect(nivelesDeComando("activar_correo_recordatorios")).toEqual([
      "consentimiento",
    ]);
    for (const nombre of [
      "pausar_recordatorios",
      "silenciar_tipo_recordatorio",
      "cambiar_horario_silencioso",
      "activar_correo_recordatorios",
    ]) {
      expect(nombres).toContain(nombre);
    }
  });

  it("el unico comando `consentimiento` del catalogo esta cubierto", () => {
    // `40` §7 tiene exactamente uno. Si aparece un segundo, esta tanda no lo
    // cubre y el censo tiene que decirlo en vez de callarlo.
    const consentimiento = CATALOGO_GENERADO.comandos
      .filter((comando) => comando.niveles.includes("consentimiento"))
      .map((comando) => comando.nombre);
    expect(consentimiento).toEqual(["activar_correo_recordatorios"]);
    expect(nombres).toContain("activar_correo_recordatorios");
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
