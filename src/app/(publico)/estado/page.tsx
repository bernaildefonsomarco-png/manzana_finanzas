import { PlaceholderSection } from "@/shared/placeholder-section";

// `SCR-AYUDA-06` (`48`, `50` §5.2), dueño de un corte posterior. `W-07`
// entrega la URL pública que `proxy.ts` ya declara en `PUBLIC_PATHS`.
export default function EstadoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <PlaceholderSection
        title="Estado del producto"
        description="El estado en vivo de Manzana se publica en un corte posterior."
        backHref="/"
        backLabel="Volver al inicio"
      />
    </main>
  );
}
