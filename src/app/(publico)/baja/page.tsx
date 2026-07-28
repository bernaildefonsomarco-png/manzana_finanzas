import { PlaceholderSection } from "@/shared/placeholder-section";

// `SCR-MAIL-02` (`46`, `50` §5.2): baja de correo en un clic con `?t=` firmado,
// dueño de un corte posterior. `W-07` entrega la URL pública que `proxy.ts`
// ya declara en `PUBLIC_PATHS`; verificar el token es trabajo de ese corte.
export default function BajaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <PlaceholderSection
        title="Baja de notificaciones por correo"
        description="Este enlace se activa junto al módulo de recordatorios por correo."
        backHref="/"
        backLabel="Volver al inicio"
      />
    </main>
  );
}
