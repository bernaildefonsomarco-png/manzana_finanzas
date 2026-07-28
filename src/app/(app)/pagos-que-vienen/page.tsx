"use client";

import { useRouter } from "next/navigation";
import { UpcomingScreen } from "@/features/upcoming/upcoming-screen";
import type { DebtScreenIntent } from "@/features/debts/debts-types";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function PagosQueVienenPage() {
  const router = useRouter();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  function onOpenDebt(intent: DebtScreenIntent) {
    const params = new URLSearchParams({ accion: intent.action });
    if (intent.installmentId) params.set("cuota", intent.installmentId);
    router.push(`/deudas/${intent.debtId}?${params.toString()}`);
  }

  return <UpcomingScreen onNavigate={onNavigate} onSignOut={onSignOut} onOpenDebt={onOpenDebt} />;
}
