"use client";

import type { ReactNode } from "react";
import type { EvidenceReference } from "@/core/channel/types";
import { cn } from "@/ui/primitivas/cn";

export type EvidenceLinkProps = {
  /** El contenido destacado (normalmente un `MoneyText`) que se hace pulsable. */
  children: ReactNode;
  references: EvidenceReference[];
  /** `ACT-ASI-07`: qué hace "ver la evidencia" lo decide quien monta la pantalla. */
  onShowEvidence: (references: EvidenceReference[]) => void;
  className?: string;
};

/**
 * `41` §4/§12, `AC-ASI-12`: toda `cifra` lleva su enlace de evidencia — sin
 * el, la cifra no es un bloque valido (`21` §5 regla 1). Envuelve el valor
 * destacado (`MoneyText`) en un boton real, no un `<a>` decorativo: no hay
 * navegacion, hay una accion ("mostrar de donde sale esto").
 */
export function EvidenceLink({
  children,
  references,
  onShowEvidence,
  className,
}: EvidenceLinkProps) {
  if (references.length === 0) return <>{children}</>;

  return (
    <button
      type="button"
      onClick={() => onShowEvidence(references)}
      aria-label={`Ver de donde sale esta cifra (${references.length} ${
        references.length === 1 ? "referencia" : "referencias"
      })`}
      className={cn(
        "rounded-sm underline decoration-dotted decoration-from-font underline-offset-4",
        "hover:decoration-solid",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        className
      )}
    >
      {children}
    </button>
  );
}
