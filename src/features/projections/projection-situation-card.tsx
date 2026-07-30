"use client";

import { Card } from "@/ui/primitivas/card";

export function ProjectionSituationCard({ facts }: { facts: string[] }) {
  return (
    <Card className="p-6">
      <h2 className="font-heading text-lg font-semibold">
        Situación de este mes
      </h2>
      <ul className="mt-4 space-y-3">
        {facts.map((fact) => (
          <li
            key={fact}
            className="rounded-lg bg-bg-surface px-3 py-3 text-sm text-text-secondary"
          >
            {fact}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-text-muted">
        Son componentes observables, sin puntuación ni comparación con otras
        personas.
      </p>
    </Card>
  );
}
