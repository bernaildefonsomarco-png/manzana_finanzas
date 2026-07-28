"use client";

import { MoneyScreen } from "@/features/money/money-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function MiDineroPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <MoneyScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
