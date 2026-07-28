import { PlaceholderSection } from "@/shared/placeholder-section";

// Doc `35`, dueño `W-14`. La librería de gráficos se elige en ese corte,
// con su caso difícil escrito primero (`WEB-D165`, `WEB-D186`).
export default function ReportesPage() {
  return (
    <PlaceholderSection
      title="Reportes"
      description="Reportes y gráficos llegan en un corte posterior."
      backHref="/inicio"
      backLabel="Volver al inicio"
    />
  );
}
