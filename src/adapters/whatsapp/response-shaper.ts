import type { Block, BlockOption } from "@/core/channel/types";
import type { WhatsAppWindowState } from "@/data/repositories/whatsapp-window.repository";
import { normalizeWhatsAppFormatting } from "./formatting";
import { planWhatsAppDelivery, type WhatsAppDeliveryPlan } from "./window-manager";
import type { WhatsAppInteractivePayload } from "./types";

export type WhatsAppShapedResponse =
  | { kind: "not_sendable"; reason: "no_blocks" | "delivery_mode_not_sendable" }
  | { kind: "freeform"; text: string; deliveryPlan: WhatsAppDeliveryPlan }
  | {
      kind: "interactive";
      text: string;
      interactive: WhatsAppInteractivePayload;
      deliveryPlan: WhatsAppDeliveryPlan;
    };

/**
 * Unico sitio que traduce bloques (21 S5) a texto libre o botones de
 * WhatsApp. El nucleo no sabe que esta funcion existe.
 */
export function shapeBlocksForWhatsApp(input: {
  blocks: Block[];
  intent: "direct_response" | "pending_confirmation";
  windowState: WhatsAppWindowState | null;
  now?: Date;
}): WhatsAppShapedResponse {
  if (input.blocks.length === 0) {
    return { kind: "not_sendable", reason: "no_blocks" };
  }

  const text = renderBlocksToText(input.blocks);
  const interactive = buildInteractivePayload(input.blocks, text);

  const deliveryPlan = planWhatsAppDelivery({
    state: input.windowState,
    intent: input.intent,
    hasActionableValue: true,
    userInitiatedResponse: true,
    preferInteractive: Boolean(interactive),
    now: input.now,
  });

  if (deliveryPlan.mode === "interactive" && interactive) {
    return {
      kind: "interactive",
      text: normalizeWhatsAppFormatting(text),
      interactive: {
        ...interactive,
        bodyText: normalizeWhatsAppFormatting(interactive.bodyText),
      },
      deliveryPlan,
    };
  }

  if (deliveryPlan.mode !== "freeform") {
    return { kind: "not_sendable", reason: "delivery_mode_not_sendable" };
  }

  return { kind: "freeform", text: normalizeWhatsAppFormatting(text), deliveryPlan };
}

function renderBlocksToText(blocks: Block[]): string {
  return blocks.map(renderBlockToText).join("\n\n");
}

function renderBlockToText(block: Block): string {
  switch (block.kind) {
    case "texto":
    case "cifra":
    case "pregunta":
    case "propuesta":
      return block.text;
    case "lista":
      return block.text;
    case "limite":
      return block.manualPath ? `${block.text}\nPuedes editarla desde Movimientos: ${block.manualPath}` : block.text;
    case "hallazgo":
      return block.text;
    case "previsualizacion":
      return block.text;
    case "mostrar":
      return block.reason;
    case "accion":
      return block.text;
  }
}

// Solo pregunta/propuesta llevan opciones pulsables en 21 S5; WhatsApp las
// materializa como botones (maximo 3, limite del proveedor).
function buildInteractivePayload(blocks: Block[], bodyText: string): WhatsAppInteractivePayload | null {
  const withOptions = blocks.find(
    (block): block is Extract<Block, { kind: "pregunta" | "propuesta" }> =>
      (block.kind === "pregunta" || block.kind === "propuesta") && block.options.length > 0
  );
  if (!withOptions) return null;

  return {
    type: "button",
    bodyText,
    buttons: withOptions.options.map(toWhatsAppButton),
  };
}

function toWhatsAppButton(option: BlockOption) {
  return { id: option.id, title: option.label };
}
