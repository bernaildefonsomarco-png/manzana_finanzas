"use client";

import { useSearchParams } from "next/navigation";
import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { AssistantPanelContent } from "./assistant-panel-content";

/** `SCR-ASI-03`: la misma conversacion que el panel, a pantalla completa para un hilo largo. `?hilo=` retoma uno especifico desde `/asistente/hilos`. */
export default function AsistentePage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  const threadId = useSearchParams().get("hilo");

  return (
    <AppShell
      title="Asistente"
      activeView="assistant"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      hideMobileNavigation
    >
      <div className="h-[calc(100vh-8.5rem)] overflow-hidden rounded-2xl border border-border bg-bg-surface-raised lg:h-[calc(100vh-9.5rem)]">
        <AssistantPanelContent initialThreadId={threadId} key={threadId ?? "mas-reciente"} />
      </div>
    </AppShell>
  );
}
