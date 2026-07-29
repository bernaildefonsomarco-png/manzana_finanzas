"use client";

import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { CategoriesScreen } from "./categories-screen";

export default function CategoriasPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <AppShell title="Categorias" activeView="settings" onNavigate={onNavigate} onSignOut={onSignOut}>
      <CategoriesScreen />
    </AppShell>
  );
}
