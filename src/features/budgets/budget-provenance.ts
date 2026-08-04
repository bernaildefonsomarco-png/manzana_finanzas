import type { BudgetPeriodKind } from "@/core/budgets";
import { listMovementsFiltered } from "@/features/movements/movements-api";
import type { Movement } from "@/shared/types/domain";
import type { ProvenanceData, ProvenanceRow } from "@/ui/domain/provenance-panel";
import { periodTitle } from "./budget-options";
import type { BudgetDetailView, BudgetView } from "./budgets-types";

// `48` `RUL-AYUDA-01` sobre `12` — el "gastado" de un presupuesto es la
// misma agregación que Reportes (`RUL-REP-01`: `movementCountsForBudget`),
// así que sus filas nunca se recalculan aquí, solo se muestran.

function toRows(movements: Movement[]): ProvenanceRow[] {
  return [...movements]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .map((m) => ({
      id: m.id,
      label: m.merchant || m.description || "Movimiento",
      detail: new Date(m.occurred_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
      amount: m.amount,
      href: `/movimientos/${m.id}`,
    }));
}

/** Detalle de un presupuesto (`budget-detail-content.tsx`): `movements` ya
 * viene cargado con el registro, sin fetch adicional. */
export function buildBudgetDetailProvenance(budget: BudgetDetailView): ProvenanceData {
  const label = budget.category_name ?? "el presupuesto general";
  return {
    title: `De dónde sale este gastado de S/${budget.spent.toFixed(2)}`,
    countedLines: [
      `${budget.movements.length} movimientos de ${label}`,
      `Del ${budget.period_start} al ${budget.period_end}`,
    ],
    notCounted: [],
    rowsTitle: `Los ${budget.movements.length} movimientos`,
    rows: toRows(budget.movements),
  };
}

/** Tarjeta de la lista (`budget-list.tsx`): solo trae `movement_ids`, así
 * que hay que ir a buscar las filas. */
export async function loadBudgetSpentProvenance(budget: BudgetView): Promise<ProvenanceData> {
  const counted = new Set(budget.movement_ids);
  const movements =
    budget.movement_ids.length === 0
      ? []
      : await listMovementsFiltered({
          type: "gasto",
          from: `${budget.period_start}T00:00:00Z`,
          to: `${budget.period_end}T23:59:59Z`,
          category_id: budget.category_id ?? undefined,
          limit: Math.max(budget.movement_ids.length, 1),
        });
  const label = budget.category_name ?? "el presupuesto general";

  return {
    title: `De dónde sale este gastado de S/${budget.spent.toFixed(2)}`,
    countedLines: [`${budget.movement_ids.length} movimientos de ${label}`, `Del ${budget.period_start} al ${budget.period_end}`],
    notCounted: [],
    rowsTitle: `Los ${budget.movement_ids.length} movimientos`,
    rows: toRows(movements.filter((m) => counted.has(m.id))),
  };
}

/** Resumen del periodo (`BudgetPeriodSummary`): cifra compuesta de otras
 * cifras compuestas — baja un nivel a la vez (`48` caso borde 1): sus filas
 * son los presupuestos, no los movimientos. */
export function buildBudgetPeriodSummaryProvenance(
  budgets: BudgetView[],
  periodKind: BudgetPeriodKind,
): ProvenanceData {
  const spent = budgets.reduce((total, b) => total + b.spent, 0);
  return {
    title: `De dónde sale este gastado de S/${spent.toFixed(2)}`,
    countedLines: [`${budgets.length} ${budgets.length === 1 ? "presupuesto" : "presupuestos"} de ${periodTitle(periodKind)}`],
    notCounted: [],
    rowsTitle: "Los presupuestos",
    rows: budgets.map((b) => ({
      id: b.id,
      label: b.category_name ?? "Presupuesto general",
      detail: `${Math.round(b.percentage_exact)}% usado`,
      amount: b.spent,
      href: `/presupuestos/${b.id}`,
    })),
  };
}
