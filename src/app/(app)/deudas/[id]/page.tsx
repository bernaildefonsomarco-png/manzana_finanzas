"use client";

import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DebtsScreen } from "@/features/debts/debts-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { parseDebtScreenIntent } from "@/shared/routing/debt-intent";

// El detalle reconstruido vive en el panel accesible de `DebtsScreen`.
// Esta ruta conserva una URL navegable sin duplicar su estado ni sus acciones.
export default function DeudaDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  const urlParams = new URLSearchParams({
    debt: id,
    action: searchParams.get("accion") ?? "detail",
  });
  const installmentId = searchParams.get("cuota");
  if (installmentId) urlParams.set("installment", installmentId);
  const debtIntent = parseDebtScreenIntent(urlParams);

  return (
    <DebtsScreen
      debtIntent={debtIntent}
      onDebtIntentConsumed={() => router.replace(`/deudas/${id}`)}
      onDebtDetailClose={() => router.replace("/deudas")}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    />
  );
}
