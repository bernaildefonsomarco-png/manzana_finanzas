"use client";

import { ExportDataScreen } from "@/features/reports/export-data-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

// Doc `35` (dueño `W-14`) especifica la exportación. La eliminación de
// cuenta es de `43`/`45` (dueño `W-18` según `54` §3.1, no `W-19` como
// decía este comentario) y ya tiene pantalla real: `DeleteAccountSection`
// dentro de `ExportDataScreen` (`SCR-AUTH-08`).
export default function ConfiguracionDatosPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <ExportDataScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
