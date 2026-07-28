"use client";

import { use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DebtsScreen } from "@/features/debts/debts-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { parseDebtScreenIntent } from "@/shared/routing/debt-intent";

// `DebtsScreen` ya muestra el detalle como panel sobre su propio listado
// (`52`, condenado); montarla aquí con la intención resuelta le da a ese
// panel una URL propia y navegable (`10` §4), sin duplicar su lógica.
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
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    />
  );
}
