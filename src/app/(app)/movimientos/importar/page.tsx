import { PlaceholderSection } from "@/shared/placeholder-section";

// La familia `imports` no existe todavía (`WEB-D175`): construir la
// previsualización real es trabajo de su propio corte de módulo. Aquí solo
// la URL que `10` §3.2 declara (`AC-NAV-01`).
export default function ImportarMovimientosPage() {
  return (
    <PlaceholderSection
      title="Importar movimientos"
      description="La importación de archivos con previsualización llega en un corte posterior."
      backHref="/movimientos"
      backLabel="Volver a movimientos"
    />
  );
}
