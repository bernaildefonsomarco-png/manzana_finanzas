"use client";

import { useState } from "react";
import {
  forgetClassificationMemory,
  getClassificationWhy,
  type ClassificationWhy,
} from "@/shared/api/classification-operations";
import { Button } from "@/ui/primitivas/button";

export function ClassificationWhyPanel({ movementId }: { movementId: string }) {
  const [why, setWhy] = useState<ClassificationWhy | null>(null);
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  async function toggle() {
    if (open) { setOpen(false); return; }
    setOpen(true);
    if (why) return;
    setState("loading");
    try {
      setWhy(await getClassificationWhy(movementId));
      setState("ready");
    } catch {
      setState("error");
    }
  }

  return (
    <section className="mt-4 border-t border-border pt-4" aria-live="polite">
      <Button variant="ghost" size="sm" onClick={() => void toggle()}>{open ? "Ocultar por qué" : "Por qué se clasificó así"}</Button>
      {open && state === "loading" ? <p className="mt-3 text-sm text-text-secondary">Buscando la evidencia…</p> : null}
      {open && state === "error" ? <p className="mt-3 text-sm text-error">No pude cargar la explicación.</p> : null}
      {open && why ? (
        <div className="mt-3 rounded-lg bg-bg-surface p-4">
          <p className="text-sm font-medium text-text">{why.explanation}</p>
          {why.evidence.length > 0 ? <ul className="mt-3 list-disc pl-5 text-sm text-text-secondary">{why.evidence.map((evidence) => <li key={`${evidence.observed_at}:${evidence.polarity}`}>{evidence.text}</li>)}</ul> : null}
          {why.forget_targets.map((target) => (
            <Button
              key={target.memory_id}
              className="mt-3"
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!window.confirm(`Voy a olvidar: ${target.summary}. Los movimientos anteriores no cambiarán.`)) return;
                void forgetClassificationMemory(target.memory_id).then(() => {
                  setWhy({ ...why, forget_targets: [] });
                });
              }}
            >
              Olvidar esto que aprendiste
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
