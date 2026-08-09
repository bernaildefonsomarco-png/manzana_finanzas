"use client";

/**
 * `RUL-ASI-22`: al confirmar o descartar, el foco vuelve al campo de entrada
 * — nunca salta a otro sitio.
 *
 * Vive fuera de las tarjetas porque lo necesitan las dos formas de resolver
 * una propuesta (la tarjeta de un pendiente y los botones de una propuesta
 * sin pendiente), y una copia por sitio se desincroniza en cuanto cambie el
 * `aria-label` del compositor.
 */
export function focusAssistantComposer(): void {
  document
    .querySelector<HTMLTextAreaElement>('[aria-label="Escribe un mensaje para Manzana"]')
    ?.focus();
}
