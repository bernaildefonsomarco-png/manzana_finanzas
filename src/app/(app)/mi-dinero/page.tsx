"use client";

import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { MiDineroScreen } from "./mi-dinero-screen";

export default function MiDineroPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <AppShell title="Mi Dinero" activeView="money" onNavigate={onNavigate} onSignOut={onSignOut}>
      <MiDineroScreen />
    </AppShell>
  );
}
