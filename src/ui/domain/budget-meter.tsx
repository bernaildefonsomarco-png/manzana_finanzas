"use client";

import { MoneyText } from "@/ui/primitivas/money";
import { Progress } from "@/ui/primitivas/progress";
import type { BudgetProgressBand } from "@/core/budgets";

const BAND_LABELS: Record<BudgetProgressBand, string> = {
  holgado: "Holgado",
  atencion: "Atención",
  cerca: "Cerca",
  superado: "Superado",
};

export function BudgetMeter({
  label,
  spent,
  amount,
  percentage,
  band,
}: {
  label: string;
  spent: number;
  amount: number;
  percentage: number;
  band: BudgetProgressBand;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-4 text-sm">
        <span className="font-medium text-text">{label}</span>
        <span className="text-right text-text-secondary">
          <MoneyText value={spent} compact /> de{" "}
          <MoneyText value={amount} compact />
        </span>
      </div>
      <Progress
        value={Math.min(percentage, 100)}
        aria-label={`${label}, ${spent} de ${amount} soles, ${percentage} por ciento, ${BAND_LABELS[band]}`}
        tone={band === "superado" ? "over" : band === "holgado" ? "brand" : "low"}
      />
      <div className="flex justify-between text-xs text-text-muted">
        <span>{BAND_LABELS[band]}</span>
        <span>{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}
