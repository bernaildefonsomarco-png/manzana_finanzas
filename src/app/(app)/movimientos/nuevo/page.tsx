"use client";

import { useRouter } from "next/navigation";
import { MovementsScreen } from "@/features/movements/movements-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

// Ruta con URL propia (`10` §4): en escritorio se presenta como modal sobre
// el listado (la propia `MovementsScreen` ya abre el formulario en modal al
// montar con `openNewOnMount`); tener URL permite enlazarla desde el Home,
// un recordatorio o el asistente.
export default function MovimientoNuevoPage() {
  const router = useRouter();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <MovementsScreen
      openNewOnMount
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      onNewIntentConsumed={() => router.replace("/movimientos")}
    />
  );
}
