import type { BudgetPeriodKind } from "@/core/budgets";
import { CATEGORY_LABELS } from "@/shared/copy/category-copy";
import { CATEGORY_IDS, type CategoryId } from "@/shared/types/domain";

/**
 * Las mismas 12 categorías del canon, en forma de lista para los `<select>`
 * de presupuestos y de clasificación en lote. El orden es el de
 * `CATEGORY_IDS`, que replica el `sort_order` del seed: la lista se deriva
 * en vez de reescribirse a mano para que el desplegable no pueda llamar a
 * una categoría distinto que el resto de la app.
 */
export const CATEGORY_OPTIONS: Array<{ id: CategoryId; label: string }> =
  CATEGORY_IDS.map((id) => ({ id, label: CATEGORY_LABELS[id] }));

export function categoryLabel(categoryId: CategoryId) {
  return CATEGORY_LABELS[categoryId] ?? categoryId;
}

export function parsePeriodKind(value: string | null): BudgetPeriodKind {
  return value === "semanal" ||
    value === "quincenal" ||
    value === "mensual"
    ? value
    : "mensual";
}

export function periodTitle(periodKind: BudgetPeriodKind) {
  if (periodKind === "semanal") return "Semana actual";
  if (periodKind === "quincenal") return "Quincena actual";
  return "Mes actual";
}

export function periodLabel(periodKind: BudgetPeriodKind) {
  if (periodKind === "semanal") return "semanal";
  if (periodKind === "quincenal") return "quincenal";
  return "mensual";
}
