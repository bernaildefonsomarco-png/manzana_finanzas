import { PlaceholderSection } from "@/shared/placeholder-section";

// Flujo real (envío de correo de recuperación) es responsabilidad del
// módulo de autenticación completo, doc `43`, dueño `W-18` (`WEB-D168`):
// construirlo aquí inventaría comportamiento de producto (`RUL-HECHO-04`).
// `W-07` solo entrega la URL propia que `10` §3.1 exige.
export default function RecuperarClavePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <PlaceholderSection
        title="Recuperar contraseña"
        description="Este flujo se activa en un corte posterior, junto al resto de autenticación completa."
        backHref="/entrar"
        backLabel="Volver a entrar"
      />
    </main>
  );
}
