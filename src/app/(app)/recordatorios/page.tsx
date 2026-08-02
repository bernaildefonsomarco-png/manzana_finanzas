"use client";

import { RemindersScreen } from "@/features/reminders/reminders-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function RecordatoriosPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <RemindersScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
