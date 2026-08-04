"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";
import { startGmailOAuth } from "@/features/settings/settings-api";

// `44` `SCR-ONB-04` — pantalla propia antes de la de Google, porque la de
// Google no la controlamos y su lenguaje es de permisos, no de producto.
// "Lo que no hago" pesa tanto como "lo que hago" y va después (`44` §7):
// es el momento de mayor desconfianza legítima del producto entero.
export function EmailPermissionScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    setLoading(true);
    setError(null);
    try {
      const url = await startGmailOAuth();
      window.location.assign(url);
    } catch {
      setError("No pude empezar la conexión ahora. Inténtalo de nuevo.");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <Card elevated className="w-full max-w-[480px] p-6">
        <h1 className="font-heading text-2xl font-semibold text-text">Conectar tu correo</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Tu banco y Yape ya te avisan de cada movimiento. Puedo leerlos y anotarlos por ti.
        </p>

        <section aria-labelledby="lo-que-hago" className="mt-5">
          <h2 id="lo-que-hago" className="text-sm font-semibold text-text">
            Lo que hago
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
            <li>Leo solo los correos de los bancos que tú autorices.</li>
            <li>Todo lo que detecte espera tu confirmación.</li>
            <li>Nunca registro nada solo.</li>
          </ul>
        </section>

        <section aria-labelledby="lo-que-no-hago" className="mt-5">
          <h2 id="lo-que-no-hago" className="text-sm font-semibold text-text">
            Lo que no hago
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-text-secondary">
            <li>No guardo el contenido de tus correos.</li>
            <li>No leo nada de otros remitentes.</li>
            <li>No escribo ni envío correos desde tu cuenta.</li>
          </ul>
        </section>

        {error ? (
          <p role="alert" className="mt-4 text-sm text-error">
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex gap-2">
          <Button loading={loading} onClick={() => void handleContinue()}>
            Continuar
          </Button>
          <Button variant="secondary" disabled={loading} onClick={() => router.push("/inicio")}>
            Ahora no
          </Button>
        </div>
      </Card>
    </main>
  );
}
