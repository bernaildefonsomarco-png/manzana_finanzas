"use client";

import { DebtsScreen } from "@/features/debts/debts-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function DeudasPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <DebtsScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
