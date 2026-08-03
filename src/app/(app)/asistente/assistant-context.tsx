"use client";

import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";

type AssistantContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  /** `RUL-ASI-22`: `Esc` devuelve el foco a quien abrió el panel. */
  returnFocusToTrigger: () => void;
};

const AssistantContext = createContext<AssistantContextValue | null>(null);

/**
 * `RUL-ASI-01`: solo el estado de abierto/cerrado del panel vive aqui (una
 * preferencia de interfaz efimera). La conversacion misma —hilo, mensajes,
 * propuestas— vive en el servidor (`RUL-ASI-02`); este contexto nunca la
 * cachea, por eso sobrevive a que este componente se desmonte y remonte.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<Element | null>(null);

  const value = useMemo<AssistantContextValue>(
    () => ({
      isOpen,
      open: () => {
        triggerRef.current = document.activeElement;
        setIsOpen(true);
      },
      close: () => setIsOpen(false),
      toggle: () =>
        setIsOpen((current) => {
          if (!current) triggerRef.current = document.activeElement;
          return !current;
        }),
      returnFocusToTrigger: () => {
        if (triggerRef.current instanceof HTMLElement) triggerRef.current.focus();
      },
    }),
    [isOpen]
  );

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistantPanel(): AssistantContextValue {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error("useAssistantPanel debe usarse dentro de <AssistantProvider>.");
  }
  return context;
}
