"use client";

import { PendingScreen } from "@/features/pending/pending-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function PendientesPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <PendingScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
