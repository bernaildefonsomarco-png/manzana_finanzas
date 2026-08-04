"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";

type Door = "welcome_movement" | "welcome_account" | "welcome_email";

const DESTINATIONS: Record<Door, string> = {
  welcome_movement: "/movimientos/nuevo",
  welcome_account: "/mi-dinero",
  welcome_email: "/bienvenida/correo",
};

// `44` `SCR-ONB-02` — se muestra una vez, tras completar el registro,
// antes de llegar al Inicio (`AC-ONB-07`). Tres frases antes de la primera
// decisión, ni una más (`44` §7).
export function WelcomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState<Door | "skip" | null>(null);

  async function choose(source: Door | "welcome_skip", destination: string) {
    const key = source === "welcome_skip" ? "skip" : source;
    setLoading(key);
    // `RUL-ONB-05`: nunca se reinicia la bienvenida. Marcar el avance ANTES
    // de navegar es lo que hace que `onboarding_status` deje de ser
    // `not_started` y esta pantalla no vuelva a aparecer, elija lo que
    // elija — incluido "mirar primero" (`44` §12 caso 7).
    await fetch("/api/v1/onboarding", {
      method: "POST",
      credentials: "same-origin",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "start", source }),
    }).catch(() => undefined);
    router.push(destination);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-primary px-4 py-8">
      <Card elevated className="w-full max-w-[480px] p-6">
        <h1 className="font-heading text-2xl font-semibold text-text">Hola.</h1>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Manzana te dice cuánto dinero tienes de verdad: lo que queda después de lo que ya
          está comprometido.
        </p>
        <p className="mt-3 text-sm leading-6 text-text-secondary">
          Para eso necesito que empecemos por algo. Elige por dónde:
        </p>

        <div className="mt-6 flex flex-col gap-2">
          <Button
            className="justify-start"
            loading={loading === "welcome_movement"}
            disabled={loading !== null && loading !== "welcome_movement"}
            onClick={() => void choose("welcome_movement", DESTINATIONS.welcome_movement)}
          >
            Registrar un gasto
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            loading={loading === "welcome_account"}
            disabled={loading !== null && loading !== "welcome_account"}
            onClick={() => void choose("welcome_account", DESTINATIONS.welcome_account)}
          >
            Decirte cuánto tengo
          </Button>
          <Button
            variant="secondary"
            className="justify-start"
            loading={loading === "welcome_email"}
            disabled={loading !== null && loading !== "welcome_email"}
            onClick={() => void choose("welcome_email", DESTINATIONS.welcome_email)}
          >
            Conectar mi correo
          </Button>
        </div>

        <button
          type="button"
          className="mt-5 text-sm font-medium text-text-brand hover:text-brand-hover disabled:opacity-60"
          disabled={loading !== null}
          onClick={() => void choose("welcome_skip", "/inicio")}
        >
          Prefiero mirar primero →
        </button>
      </Card>
    </main>
  );
}
