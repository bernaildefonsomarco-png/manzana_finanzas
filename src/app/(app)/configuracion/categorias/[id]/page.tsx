"use client";

import { use } from "react";
import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { CategoryDetailView } from "./category-detail-view";

export default function CategoriaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <AppShell title="Categoria" activeView="settings" onNavigate={onNavigate} onSignOut={onSignOut}>
      <CategoryDetailView categoryId={id} />
    </AppShell>
  );
}
