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

  it("el asistente ejecuta 52 de los 99 comandos del catalogo", () => {
    // 30 antes de `RUL-LIG-01`, + las 6 acciones ligeras, + las 4 preferencias
    // de aviso de `RUL-PREF-01`, + los 6 de deudas de `RUL-DEUDAS-13`: los 5
    // del ciclo de vida mas `registrar_devolucion`, que ya era ejecutable por el
    // camino de pago y no estaba contado, + los 4 de dinero entre cuentas y
    // cajas de `24` §9 (`transferir`, `separar_en_caja`, `devolver_a_libre`,
    // `mover_entre_cajas`) + los 2 de movimientos de `26` §14.2
    // (`restaurar_movimiento`, `duplicar_movimiento`). El numero se afirma aqui
    // a proposito: si alguien cablea o descablea un comando sin tocar el
    // censo, este test lo dice.
    expect(CATALOGO_GENERADO.censo.totalComandos).toBe(99);
    expect(nombres.length).toBe(52);
  });

  it("los tres comandos de deudas diferidos NO estan en el censo", () => {
    // `WEB-D205` (`RUL-DEUDAS-11`, `RUL-DEUDAS-12`) deja fuera de V1 el ajuste
    // monetario por interes y la renegociacion, y `vincular_caja_a_deuda` no
    // tiene ejecutor en ningun sitio del producto: `boxes.linked_debt_id` solo
    // se lee. El asistente los reconoce **por su nombre** para poder decir que
    // no puede, y eso no es ejecutarlos. Si alguien los diera por cableados sin
    // escribir el ejecutor, este test lo dice.
    expect(nombres).not.toContain("registrar_interes");
    expect(nombres).not.toContain("renegociar_deuda");
    expect(nombres).not.toContain("vincular_caja_a_deuda");
  });

  it("los seis de deudas llevan el nivel que dice el catalogo", () => {
    // `RUL-DEUDAS-13` no elige el nivel: lo lee. `cerrar_deuda` es el unico de
    // riesgo, y eso es lo que le exige mas confianza y la consecuencia
    // deterministica antes de la pregunta. Si `40` reclasificara alguno, este
    // test lo dice antes de que el asistente ejecute con el nivel equivocado.
    expect(nivelesDeComando("cerrar_deuda")).toEqual(["riesgo"]);
    expect(nivelesDeComando("reabrir_deuda")).toEqual(["tarjeta"]);
    expect(nivelesDeComando("reprogramar_cuota")).toEqual(["tarjeta"]);
    expect(nivelesDeComando("saltar_cuota")).toEqual(["tarjeta"]);
    expect(nivelesDeComando("crear_persona")).toEqual(["tarjeta"]);
    expect(nivelesDeComando("registrar_devolucion")).toEqual([
      "tarjeta_editable",
    ]);
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
