"use client";

import { InsightsScreen } from "@/features/insights/insights-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function DescubrimientosPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <InsightsScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
