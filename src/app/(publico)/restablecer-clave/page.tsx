import { PlaceholderSection } from "@/shared/placeholder-section";

// Igual que `recuperar-clave`: la lógica real de token de un solo uso es
// `W-18` (doc `43`). Aquí solo existe la URL (`AC-NAV-01`).
export default function RestablecerClavePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <PlaceholderSection
        title="Definir nueva contraseña"
        description="Este flujo se activa en un corte posterior, junto al resto de autenticación completa."
        backHref="/entrar"
        backLabel="Volver a entrar"
      />
    </main>
  );
}
