"use client";

import { type ReactNode, useRef, useState } from "react";
import { ProvenancePanel, type ProvenanceData } from "./provenance-panel";

// `48` `RUL-AYUDA-01`: toda cifra es navegable hasta sus filas, siempre —
// este es el punto donde una pantalla se conecta al componente único de
// procedencia sin reimplementar el panel. `loadProvenance` se llama la
// primera vez que se abre, nunca antes: abrir el panel es la señal de que
// el usuario quiere el detalle, no una razón para pre-cargarlo en cada
// render (`RUL-AYUDA-03`: si no se puede explicar, no se emite — aquí,
// si falla la carga, se dice en vez de fingir que no hay nada que contar).
export function MoneyWithProvenance({
  children,
  loadProvenance,
  ariaLabel,
}: {
  children: ReactNode;
  loadProvenance: () => Promise<ProvenanceData>;
  /** `aria-label` del botón, con la cifra hablada (`48` §11) — nunca solo "?". */
  ariaLabel: string;
}) {
  const [state, setState] = useState<
    { status: "closed" } | { status: "loading" } | { status: "open"; data: ProvenanceData } | { status: "error" }
  >({ status: "closed" });
  const triggerRef = useRef<HTMLButtonElement>(null);

  async function handleOpen() {
    setState({ status: "loading" });
    try {
      const data = await loadProvenance();
      setState({ status: "open", data });
    } catch {
      setState({ status: "error" });
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => void handleOpen()}
        aria-label={ariaLabel}
        aria-busy={state.status === "loading"}
        className="rounded-sm text-left underline decoration-dotted decoration-from-font underline-offset-4 hover:decoration-solid focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
      >
        {children}
      </button>
      {state.status === "error" ? (
        <p role="alert" className="mt-1 text-xs text-error">
          No pude cargar de dónde sale esta cifra. Inténtalo de nuevo.
        </p>
      ) : null}
      {state.status === "open" ? (
        <ProvenancePanel
          data={state.data}
          triggerRef={triggerRef}
          onClose={() => setState({ status: "closed" })}
        />
      ) : null}
    </>
  );
}
