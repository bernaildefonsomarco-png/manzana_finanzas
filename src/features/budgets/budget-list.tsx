"use client";

import { Archive, Pause, PiggyBank, Play } from "lucide-react";
import type { BudgetPeriodKind } from "@/core/budgets";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { EmptyState } from "@/ui/primitivas/states";
import { BudgetMeter } from "@/ui/domain/budget-meter";
import { periodTitle } from "./budget-options";
import type { BudgetView } from "./budgets-types";

export function BudgetPeriodSummary({
  budgets,
  periodKind,
}: {
  budgets: BudgetView[];
  periodKind: BudgetPeriodKind;
}) {
  const spent = budgets.reduce((total, budget) => total + budget.spent, 0);
  const amount = budgets.reduce((total, budget) => total + budget.amount, 0);

  return (
    <div className="mt-3">
      <p className="text-sm text-text-secondary">
        {periodTitle(periodKind)} · {budgets.length}{" "}
        {budgets.length === 1 ? "presupuesto" : "presupuestos"}
      </p>
      <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <dt className="text-xs text-text-muted">Gastado</dt>
          <dd className="mt-1 font-heading text-lg font-semibold">
            <MoneyText value={spent} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-text-muted">Presupuestado</dt>
          <dd className="mt-1 font-heading text-lg font-semibold">
            <MoneyText value={amount} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export function BudgetList({
  budgets,
  pending,
  onAction,
  onCreate,
}: {
  budgets: BudgetView[];
  pending: boolean;
  onAction: (id: string, action: "pause" | "resume" | "archive") => void;
  onCreate: () => void;
}) {
  if (budgets.length === 0) {
    return (
      <EmptyState
        icon={<PiggyBank className="h-6 w-6" />}
        title="Todavía no tienes presupuestos"
        description="Un presupuesto es una referencia del periodo. No aparta saldo ni bloquea gastos."
        action={<Button onClick={onCreate}>Crear presupuesto</Button>}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {budgets.map((budget) => (
        <Card key={budget.id} className="p-5">
          <BudgetMeter
            label={budget.category_name ?? "Presupuesto general"}
            spent={budget.spent}
            amount={budget.amount}
            percentage={budget.percentage_exact}
            band={budget.band}
          />
          {budget.rollover_amount > 0 ? (
            <p className="mt-3 text-xs text-text-muted">
              Incluye <MoneyText value={budget.rollover_amount} /> del periodo
              anterior.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/presupuestos/${budget.id}`}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-bg-surface"
            >
              Ver detalle
            </a>
            {budget.band === "superado" ? (
              <a
                href={`/presupuestos/${budget.id}?accion=ajustar`}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-bg-surface"
              >
                Ajustar el presupuesto
              </a>
            ) : null}
            <Button
              size="sm"
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
                onAction(
                  budget.id,
                  budget.status === "pausado" ? "resume" : "pause"
                )
              }
            >
              {budget.status === "pausado" ? "Reactivar" : "Pausar"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              icon={<Archive className="h-4 w-4" />}
              onClick={() => onAction(budget.id, "archive")}
            >
              Archivar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
