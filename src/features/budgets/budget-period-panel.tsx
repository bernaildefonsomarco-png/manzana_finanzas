"use client";

import { Copy } from "lucide-react";
import type { BudgetPeriodKind } from "@/core/budgets";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Select } from "@/ui/primitivas/field";
import { BudgetPeriodSummary } from "./budget-list";
import type { BudgetView } from "./budgets-types";

export function BudgetPeriodPanel({
  budgets,
  periodKind,
  onPeriodChange,
  onCopy,
}: {
  budgets: BudgetView[];
  periodKind: BudgetPeriodKind;
  onPeriodChange: (periodKind: BudgetPeriodKind) => void;
  onCopy: () => void;
}) {
  return (
    <section
      aria-labelledby="budget-period-title"
      className="grid gap-4 rounded-xl border border-border bg-bg-surface-raised p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
    >
      <div>
        <h2
          id="budget-period-title"
          className="font-heading text-lg font-semibold"
        >
          Resumen del periodo
        </h2>
        <BudgetPeriodSummary budgets={budgets} periodKind={periodKind} />
      </div>
      <div className="flex flex-col gap-3 sm:items-end">
        <FieldShell label="Periodo" htmlFor="budget-period">
          <Select
            id="budget-period"
            value={periodKind}
            onChange={(event) =>
              onPeriodChange(event.target.value as BudgetPeriodKind)
            }
            className="sm:w-52"
          >
            <option value="semanal">Semanal</option>
            <option value="quincenal">Quincenal</option>
            <option value="mensual">Mensual</option>
          </Select>
        </FieldShell>
        <Button
          variant="secondary"
          icon={<Copy className="h-4 w-4" />}
          onClick={onCopy}
        >
          Copiar periodo anterior
        </Button>
      </div>
    </section>
  );
}
