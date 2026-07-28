"use client";

import { useEffect } from "react";

/**
 * Para capas no modales (`Popover`, `DropdownMenu`, `Combobox`): `Escape`
 * cierra y un clic fuera de `containerRef` cierra, pero — a diferencia de
 * `useFocusTrap` — no atrapa el foco ni bloquea el scroll del fondo
 * (`16` §4.2: "no atrapa el foco").
 */
export function useDismissableLayer(
  containerRef: React.RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void
) {
  useEffect(() => {
    if (!active) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismiss();
    }
    function handlePointerDown(event: MouseEvent) {
      const container = containerRef.current;
      if (container && !container.contains(event.target as Node)) {
        onDismiss();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [active, containerRef, onDismiss]);
}
