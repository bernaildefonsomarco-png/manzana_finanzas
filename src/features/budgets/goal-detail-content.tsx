"use client";

import { Box as BoxIcon } from "lucide-react";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { BudgetMeter } from "@/ui/domain/budget-meter";
import type { GoalView } from "./budgets-types";

export function GoalDetailContent({
  goal,
  pending,
  onStatus,
  onLinkBox,
}: {
  goal: GoalView;
  pending: boolean;
  onStatus: (action: "pause" | "resume" | "unlink-box") => void;
  onLinkBox: () => void;
}) {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold">{goal.name}</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Objetivo <MoneyText value={goal.target_amount} />
          </p>
        </div>
        <Badge tone={goal.box ? "success" : "neutral"}>
          {goal.box ? "Respaldada por caja" : "Sin caja"}
        </Badge>
      </div>
      {goal.box && goal.current_balance !== null && goal.progress_pct !== null ? (
        <div className="mt-6">
          <BudgetMeter
            label={goal.box.name}
            spent={goal.current_balance}
            amount={goal.target_amount}
            percentage={goal.progress_pct}
            band={goal.progress_pct >= 100 ? "superado" : "holgado"}
          />
          <Button
            className="mt-4"
            variant="secondary"
            loading={pending}
            icon={<BoxIcon className="h-4 w-4" />}
            onClick={() => onStatus("unlink-box")}
          >
            Desvincular caja
          </Button>
        </div>
      ) : (
        <div className="mt-6 rounded-lg bg-bg-surface px-4 py-4">
          <p className="text-sm text-text-secondary">
            Esta meta no tiene dinero apartado todavía. Vincula una caja
            objetivo existente para reflejar su saldo real.
          </p>
          <Button
            className="mt-3"
            variant="secondary"
            icon={<BoxIcon className="h-4 w-4" />}
            onClick={onLinkBox}
          >
            Vincular caja existente
          </Button>
        </div>
      )}
      {goal.monthly_pace !== null ? (
        <p className="mt-5 text-sm text-text-secondary">
          Para llegar en la fecha, harían falta unos{" "}
          <MoneyText value={goal.monthly_pace} /> al mes. Es un dato, no un
          aporte obligatorio.
        </p>
      ) : null}
      <Button
        className="mt-5"
        variant="secondary"
        loading={pending}
        onClick={() =>
          onStatus(goal.status === "pausada" ? "resume" : "pause")
        }
      >
        {goal.status === "pausada" ? "Reactivar" : "Pausar"}
      </Button>
    </Card>
  );
}
