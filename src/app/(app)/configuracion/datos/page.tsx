"use client";

import { ExportDataScreen } from "@/features/reports/export-data-screen";
import { useLegacyNavigate, useLegacySignOut } from "@/shared/legacy-nav/legacy-view-routes";

// Doc `35` (dueño `W-14`) especifica la exportación. La eliminación de
// cuenta es del módulo `45` (dueño `W-19`) y todavía no tiene pantalla:
// esta ruta cubre "Tus datos", no "Exportar y eliminar" completo.
export default function ConfiguracionDatosPage() {
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return <ExportDataScreen onNavigate={onNavigate} onSignOut={onSignOut} />;
}
