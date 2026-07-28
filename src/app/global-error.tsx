"use client";

import "./globals.css";

// Fallo total de la aplicación (`10` §7, `12` §13). Único en toda la app;
// reemplaza el layout raíz por completo mientras está activo, así que
// declara su propio `<html>`/`<body>`.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body>
        <main className="flex min-h-screen flex-col items-center justify-center gap-3 bg-bg-primary px-4 text-center text-text">
          <h1 className="font-heading text-2xl font-semibold">Algo falló</h1>
          <p className="max-w-sm text-sm leading-6 text-text-secondary">
            Tus datos siguen guardados. Intenta recargar la página.
          </p>
          {error.digest ? (
            <p className="text-xs text-text-muted">Código de referencia: {error.digest}</p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            className="mt-2 inline-flex h-11 items-center justify-center rounded-md bg-brand px-5 font-heading text-sm font-medium text-text-inverse hover:bg-brand-hover"
          >
            Reintentar
          </button>
        </main>
      </body>
    </html>
  );
}
