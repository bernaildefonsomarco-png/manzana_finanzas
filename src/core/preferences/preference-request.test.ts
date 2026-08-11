import { describe, expect, it } from "vitest";
import type { PreferenceChangeRequest } from "@/agents/conversational-executive-agent/types";
import { CATALOGO_GENERADO } from "@/core/catalog/generated";
import { esComandoConocido, nivelesDeComando } from "@/core/catalog";
import {
  compilePreferenceCommandPayload,
  compilePreferenceRequest,
  DIAS_DE_PAUSA_POR_DEFECTO,
  PREFERENCE_COMMAND_NAMES,
} from "./preference-request";

function request(
  overrides: Partial<PreferenceChangeRequest>,
): PreferenceChangeRequest {
  return {
    intent: "none",
    activar: true,
    reminder_kind: "",
    pausar_dias: null,
    desde_hora: null,
    hasta_hora: null,
    confidence: 0.9,
    ambiguities: [],
    ...overrides,
  };
}

describe("RUL-PREF-01: los nombres cableados son de catalogo, no inventados", () => {
  it("los cuatro intents existen en `40` §7", () => {
    for (const nombre of PREFERENCE_COMMAND_NAMES) {
      expect(esComandoConocido(nombre), `"${nombre}" no esta en el catalogo`).toBe(
        true,
      );
    }
  });

  it("ninguno es de nivel `ninguna`: los cuatro exigen confirmacion", () => {
    for (const nombre of PREFERENCE_COMMAND_NAMES) {
      expect(nivelesDeComando(nombre)).not.toContain("ninguna");
    }
  });

  it("`activar_correo_recordatorios` es el unico `consentimiento` del catalogo", () => {
    const consentimiento = CATALOGO_GENERADO.comandos
      .filter((comando) => comando.niveles.includes("consentimiento"))
      .map((comando) => comando.nombre);
    expect(consentimiento).toEqual(["activar_correo_recordatorios"]);
  });
});

describe("compilePreferenceRequest: caso feliz de cada preferencia", () => {
  it("pausar los recordatorios con los dias que pidio el usuario", () => {
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", activar: true, pausar_dias: 3 }),
      ),
    ).toEqual({ command: "pausar_recordatorios", activar: true, dias: 3 });
  });

  it("sin dias declarados, una pausa dura una semana", () => {
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", activar: true }),
      ),
    ).toEqual({
      command: "pausar_recordatorios",
      activar: true,
      dias: DIAS_DE_PAUSA_POR_DEFECTO,
    });
  });

  it("reanudar es el mismo comando con la direccion inversa", () => {
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", activar: false }),
      ),
    ).toEqual({ command: "pausar_recordatorios", activar: false });
  });

  it("silenciar un tipo de recordatorio", () => {
    expect(
      compilePreferenceRequest(
        request({
          intent: "silenciar_tipo_recordatorio",
          activar: true,
          reminder_kind: "presupuesto_umbral",
        }),
      ),
    ).toEqual({
      command: "silenciar_tipo_recordatorio",
      activar: true,
      tipo: "presupuesto_umbral",
    });
  });

  it("cambiar el horario silencioso, incluso cruzando la medianoche", () => {
    expect(
      compilePreferenceRequest(
        request({
          intent: "cambiar_horario_silencioso",
          desde_hora: "22:00",
          hasta_hora: "08:00",
        }),
      ),
    ).toEqual({
      command: "cambiar_horario_silencioso",
      desde: "22:00",
      hasta: "08:00",
    });
  });

  it("activar el correo de un tipo", () => {
    expect(
      compilePreferenceRequest(
        request({
          intent: "activar_correo_recordatorios",
          activar: true,
          reminder_kind: "cuota_proxima",
          confidence: 0.9,
        }),
      ),
    ).toEqual({
      command: "activar_correo_recordatorios",
      activar: true,
      tipo: "cuota_proxima",
    });
  });
});

describe("compilePreferenceRequest: lo que no se ejecuta", () => {
  it("`none` y `null` no son ordenes", () => {
    expect(compilePreferenceRequest(null)).toBeNull();
    expect(compilePreferenceRequest(request({ intent: "none" }))).toBeNull();
  });

  it("una sola duda declarada basta para no proponer nada", () => {
    expect(
      compilePreferenceRequest(
        request({
          intent: "silenciar_tipo_recordatorio",
          reminder_kind: "pago_proximo",
          ambiguities: ["¿de qué avisos habla?"],
        }),
      ),
    ).toBeNull();
  });

  it("por debajo del umbral de una tarjeta no se propone", () => {
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", confidence: 0.55 }),
      ),
    ).toBeNull();
  });

  it("un consentimiento exige mas certeza que una tarjeta", () => {
    // `40` §3: un `consentimiento` deja constancia. Una confianza que basta
    // para pausar unos avisos no basta para autorizar que le escriban.
    const dudoso = request({
      intent: "activar_correo_recordatorios",
      reminder_kind: "pago_proximo",
      confidence: 0.7,
    });
    expect(compilePreferenceRequest(dudoso)).toBeNull();
    expect(
      compilePreferenceRequest({ ...dudoso, confidence: 0.8 }),
    ).not.toBeNull();
    // El mismo 0.7 si alcanza para una `tarjeta`.
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", confidence: 0.7 }),
      ),
    ).not.toBeNull();
  });

  it("un tipo de recordatorio que no existe no se aproxima al mas parecido", () => {
    expect(
      compilePreferenceRequest(
        request({
          intent: "silenciar_tipo_recordatorio",
          reminder_kind: "pagos_proximos",
        }),
      ),
    ).toBeNull();
    expect(
      compilePreferenceRequest(
        request({ intent: "silenciar_tipo_recordatorio", reminder_kind: "" }),
      ),
    ).toBeNull();
  });

  it("un plazo fuera de rango se descarta, no se recorta", () => {
    // Recortar "pausalos un año" a 90 dias seria contestar otra cosa sin
    // decirlo.
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", pausar_dias: 365 }),
      ),
    ).toBeNull();
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", pausar_dias: 0 }),
      ),
    ).toBeNull();
  });

  it("un horario mal formado, o de duracion cero, no se traduce", () => {
    for (const [desde, hasta] of [
      ["25:00", "08:00"],
      ["22", "08:00"],
      ["", "08:00"],
      ["22:00", "22:00"],
    ]) {
      expect(
        compilePreferenceRequest(
          request({
            intent: "cambiar_horario_silencioso",
            desde_hora: desde,
            hasta_hora: hasta,
          }),
        ),
      ).toBeNull();
    }
  });
});

describe("compilePreferenceCommandPayload: el borrador se revalida al leerlo", () => {
  it("una orden bien formada vuelve tipada", () => {
    expect(
      compilePreferenceCommandPayload({
        command: "cambiar_horario_silencioso",
        desde: "23:00",
        hasta: "07:30",
      }),
    ).toEqual({
      command: "cambiar_horario_silencioso",
      desde: "23:00",
      hasta: "07:30",
    });
  });

  it("un payload corrupto no se convierte en escritura", () => {
    // El working set es transporte, no autoridad de tipos: un estado escrito
    // por otra version, o manipulado, no puede terminar en una RPC.
    expect(compilePreferenceCommandPayload(null)).toBeNull();
    expect(compilePreferenceCommandPayload({})).toBeNull();
    expect(
      compilePreferenceCommandPayload({
        command: "silenciar_tipo_recordatorio",
        activar: true,
        tipo: "lo_que_sea",
      }),
    ).toBeNull();
    expect(
      compilePreferenceCommandPayload({
        command: "borrar_todo",
        activar: true,
      }),
    ).toBeNull();
  });
});
