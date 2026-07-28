import { PlaceholderSection } from "@/shared/placeholder-section";

// El arranque de onboarding hoy vive dentro de `HomeScreen`
// (`startDashboardOnboarding`, `home-screen.tsx`); una pantalla dedicada con
// URL propia es trabajo del corte que reconstruya el Inicio (`W-15`).
export default function BienvenidaPage() {
  return (
    <PlaceholderSection
      title="Bienvenida"
      description="El recorrido de bienvenida con URL propia llega junto a la reconstrucción del Inicio."
      backHref="/inicio"
      backLabel="Volver al inicio"
    />
  );
}
