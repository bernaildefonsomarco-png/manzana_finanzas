"use client";

import { useState } from "react";
import { Button } from "@/ui/primitivas/button";

// `46` `ACT-MAIL-04` — baja total, confirma porque apaga todo de una vez.
// El resto de la pantalla es un Server Component (la baja de un solo tipo
// ya ocurrió al cargar la página); esta es la única parte que necesita
// interacción de cliente.
export function UnsubscribeAllButton({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "confirming" | "loading" | "done" | "error">("idle");

  async function handleConfirm() {
    setState("loading");
    try {
      const response = await fetch("/baja/todos", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const payload = (await response.json()) as { ok: boolean };
      setState(payload.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return <p role="status" className="text-sm text-text">Listo. No te escribiré nada más.</p>;
  }

  if (state === "confirming" || state === "loading") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-text">¿Seguro? Dejarás de recibir todos los avisos.</span>
        <Button
          variant="danger"
          size="sm"
          loading={state === "loading"}
          onClick={() => void handleConfirm()}
        >
          Sí, dejar de recibir todos
        </Button>
      </div>
    );
  }

  if (state === "error") {
    return (
      <p role="alert" className="text-sm text-error">
        No pude completarlo ahora.{" "}
        <button type="button" className="underline" onClick={() => setState("confirming")}>
          Reintentar
        </button>
      </p>
    );
  }

  return (
    <button
      type="button"
      className="text-sm font-medium text-text-brand hover:text-brand-hover"
      onClick={() => setState("confirming")}
    >
      Dejar de recibir todos
    </button>
  );
}
