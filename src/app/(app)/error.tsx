"use client";

import { Button } from "@/ui/primitivas/button";

// Error recuperable de segmento (`10` §7, `12` §13): el resto de la
// navegación sigue viva, nunca el mensaje técnico crudo (`11` §9).
export default function AppSegmentError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto mt-10 max-w-lg rounded-lg border border-error-subtle bg-error-subtle p-6 text-center">
      <h1 className="font-heading text-lg font-semibold text-text">
        No pude cargar esta sección
      </h1>
      <p className="mt-2 text-sm leading-6 text-text-secondary">
        Tus datos siguen guardados. Puedes intentarlo de nuevo.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs text-text-muted">Código de referencia: {error.digest}</p>
      ) : null}
      <Button className="mt-4" variant="secondary" onClick={reset}>
        Reintentar
      </Button>
    </div>
  );
}
