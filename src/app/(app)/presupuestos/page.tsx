"use client";

import { BudgetsScreen } from "@/features/budgets/budgets-screen";
import {
  useLegacyNavigate,
  useLegacySignOut,
} from "@/shared/legacy-nav/legacy-view-routes";

export default function PresupuestosPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <BudgetsScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
