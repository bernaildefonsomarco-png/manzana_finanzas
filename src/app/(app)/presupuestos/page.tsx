import { PlaceholderSection } from "@/shared/placeholder-section";

// Doc `32`/`33`, dueño `W-12` (`54` bloque B). Aquí solo la URL (`AC-NAV-01`).
export default function PresupuestosPage() {
  return (
    <PlaceholderSection
      title="Presupuestos"
      description="Presupuestos, metas y límites llegan en un corte posterior."
      backHref="/inicio"
      backLabel="Volver al inicio"
    />
  );
}
