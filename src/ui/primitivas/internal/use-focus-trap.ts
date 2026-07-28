"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableElements(container: HTMLElement): HTMLElement[] {
  // No se filtra por `offsetParent` (visibilidad por layout): jsdom no
  // calcula layout y siempre lo da `null`, lo que rompería el atrapado de
  // foco en las pruebas sin aportar nada que `hidden`/`display:none` vía
  // atributo ya no cubra.
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute("hidden") && el.getAttribute("aria-hidden") !== "true");
}

/**
 * Atrapa el foco dentro de `containerRef` mientras `active` es verdadero:
 * enfoca el primer elemento al abrir, `Tab`/`Shift+Tab` ciclan sin salir,
 * y al desactivarse el foco vuelve al elemento que abrió el diálogo
 * (`16` §5). Bloquea también el scroll del fondo, sin que la página salte.
 */
export function useFocusTrap(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    triggerRef.current = document.activeElement as HTMLElement | null;

    const autofocusTarget = container.querySelector<HTMLElement>("[data-autofocus]");
    const initial = autofocusTarget ?? focusableElements(container)[0] ?? container;
    if (!container.contains(document.activeElement)) {
      initial.focus();
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Tab" || !container) return;
      const focusables = focusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus?.();
    };
  }, [active, containerRef]);
}
