"use client";

import { HelpIndexScreen } from "@/features/help/help-index-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function AyudaPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <HelpIndexScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
