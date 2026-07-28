"use client";

import { useRouter } from "next/navigation";
import { HomeScreen } from "@/features/home/home-screen";
import type { DebtScreenIntent } from "@/features/debts/debts-types";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

export default function InicioPage() {
  const router = useRouter();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  function onOpenDebt(intent: DebtScreenIntent) {
    const params = new URLSearchParams({ accion: intent.action });
    if (intent.installmentId) params.set("cuota", intent.installmentId);
    router.push(`/deudas/${intent.debtId}?${params.toString()}`);
  }

  return (
    <HomeScreen
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onOpenDebt={onOpenDebt}
      onStartMovement={() => router.push("/movimientos/nuevo")}
    />
  );
}
