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

/** `WEB-D298`: el compilador ya no devuelve la orden pelada, sino que paso. */
function listo(command: unknown) {
  return { kind: "ready", command };
}

describe("compileLightActionRequest", () => {
  it("sin peticion, o con intent none, no hay accion", () => {
    expect(compileLightActionRequest(null)).toEqual({ kind: "not_requested" });
    expect(compileLightActionRequest(request())).toEqual({
      kind: "not_requested",
    });
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
    ).toEqual(
      listo({
        action: "posponer_recordatorio",
        reminderId: REMINDER_ID,
        days: 7,
      }),
    );
  });

  it("sin dias declarados, posponer es mañana y no un plazo inventado", () => {
    const command = compileLightActionRequest(
      request({ intent: "posponer_recordatorio", target_id: REMINDER_ID }),
    );
    expect(command).toEqual(
      listo({
        action: "posponer_recordatorio",
        reminderId: REMINDER_ID,
        days: 1,
      }),
    );
  });
});

/**
 * `WEB-D298`: los cinco motivos por los que esto devolvia `null` no son el
 * mismo. Que lo parecieran es la razon de que una accion pedida pudiera
 * desaparecer sin que nadie lo dijera.
 */
describe("compileLightActionRequest: no pedirlo no es lo mismo que no poder", () => {
  it("una duda declarada ya no se traga: se pregunta con las palabras del modelo", () => {
    expect(
      compileLightActionRequest(
        request({
          intent: "descartar_recordatorio",
          target_id: REMINDER_ID,
          ambiguities: ["No se cual de los tres recordatorios"],
        }),
      ),
    ).toEqual({
      kind: "needs_clarification",
      question: "No se cual de los tres recordatorios",
    });
  });

  it("poca confianza sigue siendo silencio: no consta que pidiera una accion", () => {
    // Deliberado (`RUL-LIG-02`): sin tarjeta previa no hay donde frenar
    // despues, pero tampoco se le anuncia un limite por algo que quiza no pidio.
    expect(
      compileLightActionRequest(
        request({
          intent: "descartar_recordatorio",
          target_id: REMINDER_ID,
          confidence: 0.55,
        }),
      ),
    ).toEqual({ kind: "not_requested" });
  });

  it("un target_id que no es un identificador de tool se declara, no se calla", () => {
    // El modelo copiando "el del gimnasio" en vez del `id` que devolvio la tool
    // es exactamente el fallo que este guardarrail ataja. Aqui el modelo si
    // estaba seguro de la accion: solo falla el objeto, y eso se dice.
    expect(
      compileLightActionRequest(
        request({
          intent: "descartar_descubrimiento",
          target_id: "el del gimnasio",
        }),
      ).kind,
    ).toBe("unavailable");
    expect(
      compileLightActionRequest(
        request({ intent: "descartar_descubrimiento", target_id: "" }),
      ).kind,
    ).toBe("unavailable");
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
    ).toEqual(
      listo({
        action: "marcar_descubrimiento",
        insightId: REMINDER_ID,
        value: "util",
      }),
    );
    // "mas o menos" no se redondea a util: se pregunta, que es lo que el
    // comentario decia desde el principio y nadie hacia.
    expect(
      compileLightActionRequest(
        request({
          intent: "marcar_descubrimiento",
          target_id: REMINDER_ID,
          value: "mas o menos",
        }),
      ).kind,
    ).toBe("needs_clarification");
  });

  it("un bloque del Inicio que no existe no se oculta, y se dice", () => {
    expect(
      compileLightActionRequest(
        request({ intent: "ocultar_bloque_inicio", target_id: "deudas" }),
      ).kind,
    ).toBe("unavailable");
    expect(
      compileLightActionRequest(
        request({ intent: "ocultar_bloque_inicio", target_id: "pending" }),
      ),
    ).toEqual(listo({ action: "ocultar_bloque_inicio", block: "pending" }));
    expect(
      compileLightActionRequest(
        request({ intent: "mostrar_bloque_inicio", target_id: "insight" }),
      ),
    ).toEqual(listo({ action: "mostrar_bloque_inicio", block: "insight" }));
  });
});
