"use client";

import { Pause, Play } from "lucide-react";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { BudgetMeter } from "@/ui/domain/budget-meter";
import type { BudgetDetailView } from "./budgets-types";

export function BudgetDetailContent({
  budget,
  pending,
  onStatus,
  onAdjust,
}: {
  budget: BudgetDetailView;
  pending: boolean;
  onStatus: (action: "pause" | "resume") => void;
  onAdjust: () => void;
}) {
  return (
    <>
      <Card className="p-6">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h1 className="font-heading text-xl font-semibold">
              {budget.category_name ?? "Presupuesto general"}
            </h1>
            <p className="mt-1 text-sm text-text-secondary">
              {budget.period_start} a {budget.period_end}
            </p>
          </div>
          <Badge tone={budget.status === "activo" ? "budget-ok" : "neutral"}>
            {budget.status}
          </Badge>
        </div>
        <BudgetMeter
          label={budget.category_name ?? "General"}
          spent={budget.spent}
          amount={budget.amount}
          percentage={budget.percentage_exact}
          band={budget.band}
        />
        <dl className="mt-6 grid gap-4 sm:grid-cols-3">
          <Metric label="Base" value={budget.base_amount} />
          <Metric label="Del periodo anterior" value={budget.rollover_amount} />
          <Metric label="Restante" value={budget.remaining} />
        </dl>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={pending}
            icon={
              budget.status === "pausado" ? (
                <Play className="h-4 w-4" />
              ) : (
                <Pause className="h-4 w-4" />
              )
            }
            onClick={() =>
              onStatus(budget.status === "pausado" ? "resume" : "pause")
            }
          >
            {budget.status === "pausado" ? "Reactivar" : "Pausar"}
          </Button>
          <Button variant="secondary" onClick={onAdjust}>
            Ajustar el presupuesto
          </Button>
        </div>
      </Card>
      <Card className="p-6">
        <h2 className="font-heading text-lg font-semibold">
          Movimientos que componen el avance
        </h2>
        {budget.movements.length === 0 ? (
          <p className="mt-3 text-sm text-text-secondary">
            No hay movimientos que cuenten en este periodo.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {budget.movements.map((movement) => (
              <li
                key={movement.id}
                className="flex justify-between gap-4 py-3 text-sm"
              >
                <span>{movement.description ?? movement.type}</span>
                <MoneyText value={movement.amount} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="p-6">
        <h2 className="font-heading text-lg font-semibold">Historial diario</h2>
        <p className="mt-1 text-sm text-text-secondary">
          Las fotos anteriores se conservan aunque ajustes el monto actual.
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {budget.snapshots.map((snapshot) => (
            <li key={snapshot.id} className="flex justify-between gap-4">
              <span>{snapshot.as_of}</span>
              <span>
                <MoneyText value={snapshot.spent} /> registrados
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="mt-1 font-heading text-lg font-semibold">
        <MoneyText value={value} />
      </dd>
    </div>
  );
}
