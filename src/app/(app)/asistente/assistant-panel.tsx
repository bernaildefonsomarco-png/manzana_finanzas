"use client";

import { useEffect, useId } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { cn } from "@/ui/primitivas/cn";
import { useAssistantPanel } from "./assistant-context";
import { AssistantPanelContent } from "./assistant-panel-content";

/**
 * `SCR-ASI-01`/`SCR-ASI-02`, `RUL-ASI-01`: nunca modal — sin overlay que
 * oscurezca, sin trampa de foco (a diferencia de `Sheet`/`Dialog`, que sí
 * la tienen y por eso no sirven aquí). Un único árbol montado siempre;
 * solo las clases de Tailwind cambian por punto de corte, igual que
 * `AppShell` con su barra lateral — nunca dos implementaciones que se
 * montan/desmontan según el ancho de pantalla.
 */
export function AssistantPanel() {
  const { isOpen, close, toggle, returnFocusToTrigger } = useAssistantPanel();
  const titleId = useId();
  const pathname = usePathname();
  // `/asistente` ya muestra la misma conversacion a pantalla completa
  // (`SCR-ASI-03`) — flotar encima duplicaria la misma superficie dos veces.
  const onFullConversationRoute = pathname?.startsWith("/asistente") ?? false;

  useEffect(() => {
    if (!isOpen || onFullConversationRoute) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        close();
        returnFocusToTrigger();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, close, returnFocusToTrigger, onFullConversationRoute]);

  if (onFullConversationRoute) return null;

  if (!isOpen) {
    return (
      <button
        type="button"
        aria-label="Abrir el asistente"
        onClick={toggle}
        className="fixed bottom-24 right-4 z-sticky flex h-14 w-14 items-center justify-center rounded-full bg-brand text-text-inverse shadow-lg transition hover:opacity-90 lg:bottom-6 lg:right-6"
      >
        <MessageCircle className="h-6 w-6" />
      </button>
    );
  }

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        "fixed inset-x-0 bottom-0 z-sticky h-[70vh] rounded-t-2xl border border-border bg-bg-surface-raised shadow-xl",
        "lg:inset-x-auto lg:bottom-6 lg:right-6 lg:h-[60vh] lg:w-[380px] lg:rounded-2xl",
        "xl:inset-y-0 xl:bottom-auto xl:right-0 xl:top-0 xl:h-screen xl:w-[380px] xl:rounded-none xl:border-l xl:border-y-0 xl:border-r-0"
      )}
    >
      <AssistantPanelContent onClose={close} titleId={titleId} />
    </section>
  );
}
