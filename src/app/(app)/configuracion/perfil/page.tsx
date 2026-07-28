import { PlaceholderSection } from "@/shared/placeholder-section";

// Hoy todo vive en el componente índice condenado (`SettingsScreen`,
// `WEB-D164`); esta subruta nace vacía hasta que su corte de módulo divida
// esa pantalla en secciones reales (`10` §3.2 "Cambio relevante").
export default function ConfiguracionPerfilPage() {
  return (
    <PlaceholderSection
      title="Perfil y cuenta"
      description="Esta sección se divide de la configuración general en un corte posterior."
      backHref="/configuracion"
      backLabel="Volver a configuración"
    />
  );
}
