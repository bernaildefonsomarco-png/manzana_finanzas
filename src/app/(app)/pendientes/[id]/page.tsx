import { PlaceholderSection } from "@/shared/placeholder-section";

// `PendingScreen` hoy no soporta un detalle por id fuera de su propio
// listado (`52`, condenado — `WEB-D164`); el detalle real por URL nace
// cuando `W-10` reconstruya la pantalla. Aquí solo la URL (`AC-NAV-01`).
export default function PendienteDetallePage() {
  return (
    <PlaceholderSection
      title="Detalle del pendiente"
      description="El detalle con URL propia llega junto a la reconstrucción de esta pantalla."
      backHref="/pendientes"
      backLabel="Volver a pendientes"
    />
  );
}
