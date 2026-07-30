"use client";

import { Target } from "lucide-react";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { EmptyState } from "@/ui/primitivas/states";
import { BudgetMeter } from "@/ui/domain/budget-meter";
import type { GoalView } from "./budgets-types";

export function GoalList({
  goals,
  pending,
  onAction,
  onCreate,
}: {
  goals: GoalView[];
  pending: boolean;
  onAction: (id: string, action: "pause" | "resume" | "archive") => void;
  onCreate: () => void;
}) {
  if (goals.length === 0) {
    return (
      <EmptyState
        icon={<Target className="h-6 w-6" />}
        title="Todavía no tienes metas"
        description="Puedes crear una intención y vincularla a una caja cuando quieras apartar dinero real."
        action={<Button onClick={onCreate}>Crear meta</Button>}
      />
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {goals.map((goal) => (
        <Card key={goal.id} className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-heading font-semibold">{goal.name}</h2>
              <p className="mt-1 text-sm text-text-secondary">
                Objetivo <MoneyText value={goal.target_amount} />
              </p>
            </div>
            <Badge tone={goal.box ? "success" : "neutral"}>
              {goal.box ? "Con caja" : "Sin caja"}
            </Badge>
          </div>
          {goal.box &&
          goal.current_balance !== null &&
          goal.progress_pct !== null ? (
            <div className="mt-4">
              <BudgetMeter
                label={goal.box.name}
                spent={goal.current_balance}
                amount={goal.target_amount}
                percentage={goal.progress_pct}
                band={goal.progress_pct >= 100 ? "superado" : "holgado"}
              />
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-bg-surface px-3 py-3 text-sm text-text-secondary">
              Esta meta no tiene dinero apartado todavía.
            </p>
          )}
          {goal.monthly_pace !== null ? (
            <p className="mt-3 text-sm text-text-secondary">
              Para llegar en la fecha, harían falta unos{" "}
              <MoneyText value={goal.monthly_pace} /> al mes.
            </p>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-2">
            <a
              href={`/presupuestos/${goal.id}?tipo=meta`}
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium hover:bg-bg-surface"
            >
              Ver detalle
            </a>
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() =>
                onAction(
                  goal.id,
                  goal.status === "pausada" ? "resume" : "pause"
                )
              }
            >
              {goal.status === "pausada" ? "Reactivar" : "Pausar"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              loading={pending}
              onClick={() => onAction(goal.id, "archive")}
            >
              Archivar
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
