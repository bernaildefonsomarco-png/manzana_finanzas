"use client";

import { ReminderPreferencesScreen } from "@/features/reminders/reminder-preferences-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function ConfiguracionRecordatoriosPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <ReminderPreferencesScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
