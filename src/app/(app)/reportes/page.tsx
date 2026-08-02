"use client";

import { ReportsScreen } from "@/features/reports/reports-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function ReportesPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <ReportsScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
