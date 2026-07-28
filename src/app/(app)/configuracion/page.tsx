"use client";

import { SettingsScreen } from "@/features/settings/settings-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

// `SettingsScreen` es un único componente condenado (`REEMPLAZAR`, `52` §5,
// `WEB-D164`) que hoy agrupa todas las secciones de configuración. Dividirlo
// en las subrutas de `10` §3.2 es trabajo de su propio corte de módulo; aquí
// solo se monta bajo la URL índice real.
export default function ConfiguracionPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <SettingsScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
