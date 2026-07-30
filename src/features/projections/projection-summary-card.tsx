"use client";

import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import type { PeriodProjectionView } from "./projections-types";

// W-15 lo reutiliza en Home; no se monta allí en este corte (`WEB-D223`).
export function ProjectionSummaryCard({
  projection,
}: {
  projection: PeriodProjectionView;
}) {
  const paceAssumption = projection.assumptions.find(
    (assumption) => assumption.kind === "daily_pace",
  );
  if (!projection.available || !paceAssumption) return null;
  return (
    <Card className="p-5">
      <h2 className="font-heading text-lg font-semibold">
        Proyección de cierre
      </h2>
      <p className="mt-2 text-2xl font-semibold">
        {projection.range ? (
          <>
            <MoneyText value={Number(projection.range.min)} /> a{" "}
            <MoneyText value={Number(projection.range.max)} />
          </>
        ) : (
          <MoneyText value={Number(projection.projection)} />
        )}
      </p>
      <p className="mt-2 text-sm text-text-secondary">
        Con una mediana diaria de{" "}
        <MoneyText value={Number(paceAssumption.amount)} /> y{" "}
        {projection.days_remaining} días restantes.
      </p>
    </Card>
  );
}
