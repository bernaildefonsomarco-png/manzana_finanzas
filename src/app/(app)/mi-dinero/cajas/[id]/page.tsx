"use client";

import { use } from "react";
import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { BoxDetailView } from "./box-detail-view";

export default function CajaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <AppShell title="Caja" activeView="money" onNavigate={onNavigate} onSignOut={onSignOut}>
      <BoxDetailView boxId={id} />
    </AppShell>
  );
}
