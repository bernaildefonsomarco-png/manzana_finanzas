"use client";

import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { AssistantHistoryScreen } from "./assistant-history-screen";

export default function AsistenteHilosPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <AppShell
      title="Conversaciones"
      activeView="assistant"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <AssistantHistoryScreen />
    </AppShell>
  );
}
