import { describe, expect, it } from "vitest";
import type { Block } from "@/core/channel/types";
import type { WhatsAppWindowState } from "@/data/repositories/whatsapp-window.repository";
import { shapeBlocksForWhatsApp } from "./response-shaper";

const NOW = new Date("2026-08-10T00:00:00.000Z");

/** Ventana abierta: es la unica forma de que la respuesta salga interactiva. */
const VENTANA_ABIERTA = {
  window_expires_at: new Date("2026-08-10T20:00:00.000Z").toISOString(),
} as unknown as WhatsAppWindowState;

function propuesta(confirmLabel: string): Block[] {
  return [
    {
      kind: "propuesta",
      text: "¿Creo la caja?",
      commandId: "estr:abc",
      options: [
        { id: "estr:abc", label: confirmLabel },
        { id: "estr:cancel", label: "No, cancelar" },
      ],
    },
  ];
}

describe("el limite de 20 caracteres de los botones vive en este adaptador", () => {
  // Antes se cortaba en el nucleo, al componer la opcion, y la pantalla web
  // —que no tiene ese limite— heredaba el recorte: mostraba botones como
  // "Si, actualizar la...", perdiendo justo la parte que dice que hacen.
  it("recorta el titulo largo que la respuesta si entrega entero", () => {
    const shaped = shapeBlocksForWhatsApp({
      blocks: propuesta("Sí, crea la caja del viaje a Cusco de una vez"),
      intent: "pending_confirmation",
      windowState: VENTANA_ABIERTA,
      now: NOW,
    });

    expect(shaped.kind).toBe("interactive");
    if (shaped.kind !== "interactive") return;

    const [confirmar, cancelar] = shaped.interactive.buttons;
    expect(confirmar.title.length).toBeLessThanOrEqual(20);
    expect(confirmar.title).toBe("Sí, crea la caja...");
    // El corto no se toca: truncar por truncar tambien seria un defecto.
    expect(cancelar.title).toBe("No, cancelar");
  });

  it("un titulo de exactamente 20 caracteres pasa entero", () => {
    const veinte = "Sí, crear esa caja12";
    expect(veinte).toHaveLength(20);

    const shaped = shapeBlocksForWhatsApp({
      blocks: propuesta(veinte),
      intent: "pending_confirmation",
      windowState: VENTANA_ABIERTA,
      now: NOW,
    });

    expect(shaped.kind).toBe("interactive");
    if (shaped.kind !== "interactive") return;
    expect(shaped.interactive.buttons[0].title).toBe(veinte);
  });
});
