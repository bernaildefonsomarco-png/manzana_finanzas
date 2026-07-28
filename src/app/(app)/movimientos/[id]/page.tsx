"use client";

import { use } from "react";
import { AppShell } from "@/features/app-shell/app-shell";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";
import { MovementDetailView } from "../movement-detail-view";

/**
 * Pantalla completa (`12` §6): se sirve cuando la URL se pega o se recarga
 * directamente, sin el panel de `@panel/(.)[id]/page.tsx` de por medio.
 */
export default function MovimientoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();

  return (
    <AppShell
      title="Movimiento"
      activeView="movements"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto max-w-lg">
        <MovementDetailView movementId={id} />
      </div>
    </AppShell>
  );
}
