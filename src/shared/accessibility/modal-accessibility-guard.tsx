"use client";

import { useEffect } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Refuerza todos los dialogs del producto, incluidos los legados: mueve foco
 * al abrir, lo mantiene dentro con Tab, permite Escape y devuelve el foco al
 * control que abrió el modal.
 */
export function ModalAccessibilityGuard() {
  useEffect(() => {
    let activeDialog: HTMLElement | null = null;
    let returnFocus: HTMLElement | null = null;

    function findTopDialog(): HTMLElement | null {
      const dialogs = Array.from(
        document.querySelectorAll<HTMLElement>(
          '[role="dialog"][aria-modal="true"]',
        ),
      ).filter((dialog) => dialog.offsetParent !== null);
      return dialogs.at(-1) ?? null;
    }

    function activateDialog(nextDialog: HTMLElement | null) {
      if (nextDialog === activeDialog) return;
      if (nextDialog) {
        returnFocus =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
        if (!nextDialog.hasAttribute("tabindex")) {
          nextDialog.setAttribute("tabindex", "-1");
        }
        queueMicrotask(() => {
          const first =
            nextDialog.querySelector<HTMLElement>("[autofocus]") ??
            nextDialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
            nextDialog;
          first.focus();
        });
      } else if (activeDialog && returnFocus?.isConnected) {
        returnFocus.focus();
        returnFocus = null;
      }
      activeDialog = nextDialog;
    }

    const observer = new MutationObserver(() => activateDialog(findTopDialog()));
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "hidden", "aria-hidden"],
    });
    activateDialog(findTopDialog());

    function onKeyDown(event: KeyboardEvent) {
      const dialog = findTopDialog();
      if (!dialog) return;
      if (event.key === "Escape") {
        const closeControl = Array.from(
          dialog.querySelectorAll<HTMLElement>("button"),
        ).find((button) => {
          const label = (
            button.getAttribute("aria-label") ??
            button.textContent ??
            ""
          ).toLocaleLowerCase("es");
          return (
            label.includes("cerrar") ||
            label === "cancelar" ||
            label === "volver"
          );
        });
        if (closeControl) {
          event.preventDefault();
          closeControl.click();
        }
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (element) =>
          element.offsetParent !== null &&
          element.getAttribute("aria-hidden") !== "true",
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      observer.disconnect();
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
