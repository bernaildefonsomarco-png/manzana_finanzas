"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MovementsScreen } from "@/features/movements/movements-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

// `searchParams` como prop es para Server Components (`12` §4); un Client
// Component lee filtros de la URL con `useSearchParams()`.
export default function MovimientosPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <MovementsScreen
      key={query}
      initialQuery={query}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onNewIntentConsumed={() => router.replace("/movimientos")}
    />
  );
}
