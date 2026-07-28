import Link from "next/link";

// Recurso inexistente, con salida clara (`10` §7, `12` §13). Único en la
// raíz de la app; cada segmento puede declarar el suyo si necesita una
// salida más específica.
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-primary px-4 text-center">
      <h1 className="font-heading text-2xl font-semibold text-text">No encontré esa página</h1>
      <p className="max-w-sm text-sm leading-6 text-text-secondary">
        Puede que el enlace esté roto o que la página se haya movido.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex h-11 items-center justify-center rounded-md border border-brand bg-brand px-5 font-heading text-sm font-medium text-text-inverse transition hover:bg-brand-hover"
      >
        Volver al inicio
      </Link>
    </main>
  );
}
