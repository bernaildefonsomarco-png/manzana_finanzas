"use client";

import { use } from "react";
import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { AccountDetailView } from "./account-detail-view";

export default function CuentaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <AppShell title="Cuenta" activeView="money" onNavigate={onNavigate} onSignOut={onSignOut}>
      <AccountDetailView accountId={id} />
    </AppShell>
  );
}
