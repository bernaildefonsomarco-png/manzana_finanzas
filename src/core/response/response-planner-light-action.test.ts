import { describe, expect, it } from "vitest";
import type { TurnInput } from "@/core/channel/types";
import { planTurnBlocks } from "./response-planner";

const USER_ID = "00000000-0000-4000-8000-0000000000f1";

const turnInput: TurnInput = {
  actor: "user",
  text: "descarta ese recordatorio",
  choice: null,
  confirmation: null,
  attachments: [],
  context: { where: null, filters: null, selected: null, visible: [] },
  channel: "dashboard",
};

function plan(extra: Record<string, unknown>) {
  return planTurnBlocks({
    turnInput,
    userId: USER_ID,
    ...extra,
  } as Parameters<typeof planTurnBlocks>[0]);
}

describe("RUL-LIG-01: nivel `ninguna` es sin tarjeta, no sin decirlo", () => {
  it("el texto del ejecutor sale como bloque de texto, verbatim", () => {
    const texto =
      "Listo, descarté ese recordatorio. No cambié ningún movimiento ni saldo, y si la causa sigue vigente volverá a aparecer solo.";

    const result = plan({ lightActionText: texto });

    expect(result.reason).toBe("light_action_answered");
    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0]).toMatchObject({ kind: "texto", text: texto });
  });

  it("no lleva botones: no hay nada que confirmar despues de hacerlo", () => {
    const result = plan({ lightActionText: "Listo, oculté el de pendientes." });

    expect(result.blocks[0]).not.toHaveProperty("opciones");
  });

  it("un fallo tambien se dice: el turno nunca queda en cero bloques", () => {
    const result = plan({
      lightActionText:
        "No pude hacer eso ahora mismo, así que no cambié nada. Vuelve a pedírmelo en un momento.",
    });

    expect(result.blocks.length).toBeGreaterThan(0);
  });

  it("un texto vacio no crea un bloque mudo: cae al camino normal del turno", () => {
    // Si el ejecutor degradara a cadena vacia, este camino no puede persistir un
    // mensaje sin contenido — deja que el resto del planificador conteste.
    const result = plan({ lightActionText: "   " });

    expect(result.reason).not.toBe("light_action_answered");
  });

  it("la privacidad sigue yendo primero: memoria gana a la accion ligera", () => {
    const result = plan({
      memoryControlText: "Desactivé el aprendizaje.",
      lightActionText: "Listo, oculté el de pendientes.",
    });

    expect(result.reason).toBe("memory_control_answered");
  });
});
