import { Card } from "@/ui/primitivas/card";

// `43` §12 — "Cuenta recién eliminada": pantalla de despedida, **sin**
// formulario de recuperación. No es `/entrar`: esa pantalla sí tiene
// formulario, y mostrarlo aquí invitaría a "recuperar" una cuenta que ya
// no existe (`RUL-AUTH-10`, irreversible).
export default function CuentaEliminadaPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8 text-center">
      <Card elevated className="w-full max-w-[440px] p-6">
        <h1 className="font-heading text-2xl font-semibold text-text">Tu cuenta se eliminó</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Borramos tus datos de Manzana. Si tenías un correo conectado, también revocamos el
          permiso con Google.
        </p>
      </Card>
    </main>
  );
}
