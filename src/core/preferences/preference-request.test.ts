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

/** `WEB-D298`: el compilador ya no devuelve el comando pelado, sino que paso. */
function listo(command: unknown) {
  return { kind: "ready", command };
}

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
    ).toEqual(listo({ command: "pausar_recordatorios", activar: true, dias: 3 }));
  });

  it("sin dias declarados, una pausa dura una semana", () => {
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", activar: true }),
      ),
    ).toEqual(
      listo({
        command: "pausar_recordatorios",
        activar: true,
        dias: DIAS_DE_PAUSA_POR_DEFECTO,
      }),
    );
  });

  it("reanudar es el mismo comando con la direccion inversa", () => {
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", activar: false }),
      ),
    ).toEqual(listo({ command: "pausar_recordatorios", activar: false }));
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
    ).toEqual(
      listo({
        command: "silenciar_tipo_recordatorio",
        activar: true,
        tipo: "presupuesto_umbral",
      }),
    );
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
    ).toEqual(
      listo({
        command: "cambiar_horario_silencioso",
        desde: "22:00",
        hasta: "08:00",
      }),
    );
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
    ).toEqual(
      listo({
        command: "activar_correo_recordatorios",
        activar: true,
        tipo: "cuota_proxima",
      }),
    );
  });
});

/**
 * `WEB-D298`: "no se ejecuta" son en realidad tres cosas distintas, y hasta
 * ahora las tres devolvian `null`. Desde fuera eran indistinguibles, asi que el
 * turno las trataba igual: contestaba amable y no hacia nada. Estos tests fijan
 * cual es cual, porque de esa diferencia depende que la persona se entere.
 */
describe("compilePreferenceRequest: no pedirlo no es lo mismo que no poder", () => {
  it("`none` y `null` son silencio legitimo: este turno no pedia nada", () => {
    expect(compilePreferenceRequest(null)).toEqual({ kind: "not_requested" });
    expect(compilePreferenceRequest(request({ intent: "none" }))).toEqual({
      kind: "not_requested",
    });
  });

  it("una sola duda declarada no se ejecuta: se pregunta con las palabras del modelo", () => {
    expect(
      compilePreferenceRequest(
        request({
          intent: "silenciar_tipo_recordatorio",
          reminder_kind: "pago_proximo",
          ambiguities: ["¿de qué avisos habla?"],
        }),
      ),
    ).toEqual({
      kind: "needs_clarification",
      question: "¿de qué avisos habla?",
    });
  });

  it("por debajo del umbral sigue siendo silencio: no consta que pidiera nada", () => {
    // Deliberado (`RUL-PREF-02`): poca confianza no es "fallo la accion", es
    // "no esta claro que esto fuera una accion". Anunciar un limite aqui seria
    // inventarle a la persona un pedido que quiza no hizo.
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", confidence: 0.55 }),
      ),
    ).toEqual({ kind: "not_requested" });
  });

  it("un consentimiento exige mas certeza que una tarjeta", () => {
    // `40` §3: un `consentimiento` deja constancia. Una confianza que basta
    // para pausar unos avisos no basta para autorizar que le escriban.
    const dudoso = request({
      intent: "activar_correo_recordatorios",
      reminder_kind: "pago_proximo",
      confidence: 0.7,
    });
    expect(compilePreferenceRequest(dudoso).kind).toBe("not_requested");
    expect(
      compilePreferenceRequest({ ...dudoso, confidence: 0.8 }).kind,
    ).toBe("ready");
    // El mismo 0.7 si alcanza para una `tarjeta`.
    expect(
      compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", confidence: 0.7 }),
      ).kind,
    ).toBe("ready");
  });

  it("un tipo de recordatorio que no existe se pregunta, no se aproxima ni se calla", () => {
    // El vocabulario cerrado de `37` es cosa nuestra, no un fallo de la
    // persona: por eso se pregunta en vez de declarar un limite.
    for (const kind of ["pagos_proximos", ""]) {
      const resultado = compilePreferenceRequest(
        request({
          intent: "silenciar_tipo_recordatorio",
          reminder_kind: kind,
        }),
      );
      expect(resultado.kind).toBe("needs_clarification");
    }
  });

  it("un plazo fuera de rango no se recorta ni se descarta: se pregunta", () => {
    // Recortar "pausalos un año" a 90 dias seria contestar otra cosa sin
    // decirlo; dejarlo caer era no contestar nada.
    for (const dias of [365, 0]) {
      const resultado = compilePreferenceRequest(
        request({ intent: "pausar_recordatorios", pausar_dias: dias }),
      );
      expect(resultado.kind).toBe("needs_clarification");
    }
  });

  it("un horario mal formado, o de duracion cero, se pregunta", () => {
    for (const [desde, hasta] of [
      ["25:00", "08:00"],
      ["22", "08:00"],
      ["", "08:00"],
      ["22:00", "22:00"],
    ]) {
      const resultado = compilePreferenceRequest(
        request({
          intent: "cambiar_horario_silencioso",
          desde_hora: desde,
          hasta_hora: hasta,
        }),
      );
      expect(resultado.kind).toBe("needs_clarification");
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
