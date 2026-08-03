"use client";

import { useEffect, useState } from "react";

/** `23` §5: un turno completo tiene un presupuesto de 8s; pasado ese punto, `RUL-ASI-12` pide avisar sin cancelar lo que sigue en curso. */
const SLOW_TURN_THRESHOLD_MS = 8_000;

export function useAssistantSlowTurn(isSending: boolean): boolean {
  const [isSlow, setIsSlow] = useState(false);
  // Reinicia el aviso al arrancar un turno nuevo — ajuste de estado durante
  // el render (no en un efecto) siguiendo el patron que React recomienda
  // para "adjusting state when a prop changes", sin el setState sincrono
  // dentro de un efecto que `react-hooks/set-state-in-effect` rechaza.
  const [trackedSending, setTrackedSending] = useState(isSending);
  if (isSending !== trackedSending) {
    setTrackedSending(isSending);
    setIsSlow(false);
  }

  useEffect(() => {
    if (!isSending) return;
    const timer = window.setTimeout(() => setIsSlow(true), SLOW_TURN_THRESHOLD_MS);
    return () => window.clearTimeout(timer);
  }, [isSending]);

  return isSlow && isSending;
}
