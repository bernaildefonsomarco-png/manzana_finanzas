"use client";

import Link from "next/link";
import type { DegradationGrade } from "@/core/degradation/grade";
import { Button } from "@/ui/primitivas/button";

const MESSAGES: Partial<Record<DegradationGrade, string>> = {
  sin_modelo: "No puedo ayudarte con eso ahora mismo.",
  solo_lectura: "Ahora mismo respondo y explico, pero no propongo acciones.",
};

/**
 * `SCR-ASI-07`, `RUL-ASI-13`: no se oculta, no inventa, no deja sin
 * salida. `lento` no vive aqui — se dispara por un turno concreto que
 * tarda, no por este chequeo estatico al abrir el panel (`AssistantMessageList`).
 */
export function AssistantDegradationBanner({ grade }: { grade: DegradationGrade | undefined }) {
  if (!grade || grade === "normal" || grade === "lento") return null;
  const message = MESSAGES[grade];
  if (!message) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 border-b border-warning-subtle bg-warning-subtle px-4 py-2 text-sm text-warning-on-subtle"
    >
      <p>{message}</p>
      {grade === "sin_modelo" ? (
        <Link href="/movimientos/nuevo">
          <Button type="button" variant="secondary" size="sm">
            Nuevo movimiento
          </Button>
        </Link>
      ) : null}
    </div>
  );
}
