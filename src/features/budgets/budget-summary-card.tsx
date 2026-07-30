"use client";

import Link from "next/link";
import { Card } from "@/ui/primitivas/card";
import { BudgetMeter } from "@/ui/domain/budget-meter";
import type { BudgetView } from "./budgets-types";

/** Preparado para `SCR-PRES-05`; Home lo monta en W-15 (`WEB-D223`). */
export function BudgetSummaryCard({ budgets }: { budgets: BudgetView[] }) {
  const visible = budgets.slice(0, 3);
  if (visible.length === 0) return null;
  return (
    <Card className="space-y-5 p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-lg font-semibold">Presupuestos</h2>
        <Link
          href="/presupuestos"
          className="text-sm font-medium text-text-secondary"
        >
          Ver todos
        </Link>
      </div>
      {visible.map((budget) => (
        <BudgetMeter
          key={budget.id}
          label={budget.category_name ?? "General"}
          spent={budget.spent}
          amount={budget.amount}
          percentage={budget.percentage_exact}
          band={budget.band}
        />
      ))}
    </Card>
  );
}
