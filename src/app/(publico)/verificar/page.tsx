import { PlaceholderSection } from "@/shared/placeholder-section";

// Reenvío de verificación de correo: `W-18` (doc `43`). Aquí solo la URL.
export default function VerificarPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <PlaceholderSection
        title="Verifica tu correo"
        description="Este flujo se activa en un corte posterior, junto al resto de autenticación completa."
        backHref="/entrar"
        backLabel="Volver a entrar"
      />
    </main>
  );
}
