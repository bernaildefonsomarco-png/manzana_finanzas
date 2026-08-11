import { describe, expect, it } from "vitest";
import type { LightActionRequest } from "@/agents/conversational-executive-agent/types";
import { esComandoDeNivel } from "@/core/catalog";
import {
  compileLightActionRequest,
  LIGHT_ACTION_COMMAND_NAMES,
} from "./light-action-request";

function request(overrides: Partial<LightActionRequest> = {}): LightActionRequest {
  return {
    intent: "none",
    target_id: "",
    value: "",
    postpone_days: null,
    confidence: 0.9,
    ambiguities: [],
    ...overrides,
  };
}

const REMINDER_ID = "11111111-2222-3333-4444-555555555555";

describe("el catalogo manda: ningun nombre cableado aqui es de otro nivel", () => {
  it.each(LIGHT_ACTION_COMMAND_NAMES)(
    "`%s` es nivel `ninguna` en el catalogo generado de `40` §7",
    (nombre) => {
      // Si alguien sube el nivel de uno de estos comandos en la documentacion,
      // este test falla y obliga a sacarlo de aqui en vez de dejar que se siga
      // ejecutando sin la tarjeta que el catalogo ya exige.
      expect(esComandoDeNivel(nombre, "ninguna")).toBe(true);
    },
  );
});

describe("compileLightActionRequest", () => {
  it("sin peticion, o con intent none, no hay accion", () => {
    expect(compileLightActionRequest(null)).toBeNull();
    expect(compileLightActionRequest(request())).toBeNull();
  });

  it("compila posponer_recordatorio con los dias que pidio el usuario", () => {
    expect(
      compileLightActionRequest(
        request({
          intent: "posponer_recordatorio",
          target_id: REMINDER_ID,
          postpone_days: 7,
        }),
      ),
    ).toEqual({
      action: "posponer_recordatorio",
      reminderId: REMINDER_ID,
      days: 7,
    });
  });

  it("sin dias declarados, posponer es mañana y no un plazo inventado", () => {
    const command = compileLightActionRequest(
      request({ intent: "posponer_recordatorio", target_id: REMINDER_ID }),
    );
    expect(command).toEqual({
      action: "posponer_recordatorio",
      reminderId: REMINDER_ID,
      days: 1,
    });
  });

  it("una sola duda declarada basta para no ejecutar nada", () => {
    expect(
      compileLightActionRequest(
        request({
          intent: "descartar_recordatorio",
          target_id: REMINDER_ID,
          ambiguities: ["No se cual de los tres recordatorios"],
        }),
      ),
    ).toBeNull();
  });

  it("poca confianza no ejecuta: sin tarjeta previa no hay donde frenar despues", () => {
    expect(
      compileLightActionRequest(
        request({
          intent: "descartar_recordatorio",
          target_id: REMINDER_ID,
          confidence: 0.55,
        }),
      ),
    ).toBeNull();
  });

  it("un target_id que no es un identificador de tool no se ejecuta", () => {
    // El modelo copiando "el del gimnasio" en vez del `id` que devolvio la tool
    // es exactamente el fallo que este guardarrail ataja.
    expect(
      compileLightActionRequest(
        request({
          intent: "descartar_descubrimiento",
          target_id: "el del gimnasio",
        }),
      ),
    ).toBeNull();
    expect(
      compileLightActionRequest(
        request({ intent: "descartar_descubrimiento", target_id: "" }),
      ),
    ).toBeNull();
  });

  it("marcar_descubrimiento solo admite los dos valores de `34`", () => {
    expect(
      compileLightActionRequest(
        request({
          intent: "marcar_descubrimiento",
          target_id: REMINDER_ID,
          value: "UTIL",
        }),
      ),
    ).toEqual({
      action: "marcar_descubrimiento",
      insightId: REMINDER_ID,
      value: "util",
    });
    // "mas o menos" no se redondea a util: se descarta y el turno pregunta.
    expect(
      compileLightActionRequest(
        request({
          intent: "marcar_descubrimiento",
          target_id: REMINDER_ID,
          value: "mas o menos",
        }),
      ),
    ).toBeNull();
  });

  it("un bloque del Inicio que no existe no se oculta", () => {
    expect(
      compileLightActionRequest(
        request({ intent: "ocultar_bloque_inicio", target_id: "deudas" }),
      ),
    ).toBeNull();
    expect(
      compileLightActionRequest(
        request({ intent: "ocultar_bloque_inicio", target_id: "pending" }),
      ),
    ).toEqual({ action: "ocultar_bloque_inicio", block: "pending" });
    expect(
      compileLightActionRequest(
        request({ intent: "mostrar_bloque_inicio", target_id: "insight" }),
      ),
    ).toEqual({ action: "mostrar_bloque_inicio", block: "insight" });
  });
});
