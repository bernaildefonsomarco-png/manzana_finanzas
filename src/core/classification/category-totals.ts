import type { CategoryId, MovementType } from "@/shared/types/domain";
import { normalizeMovementAmount } from "@/core/finance/balance-engine";

/**
 * `RUL-CAT-11` (`25` §6): tipos que no admiten categoría de la misma
 * forma que un gasto — quedan fuera de cualquier total por categoría.
 * Incluye `transferencia`/`asignacion_interna` (`AC-CAT-06`, el ejemplo
 * que el criterio nombra explícitamente) y el resto de la tabla.
 */
export const CATEGORY_EXCLUDED_MOVEMENT_TYPES: readonly MovementType[] = [
  "transferencia",
  "asignacion_interna",
  "prestamo_dado",
  "prestamo_recibido",
  "devolucion_recibida",
  "deuda_adquirida",
  "ajuste",
];

export type CategoryTotalsInputMovement = {
  type: MovementType;
  category_id: CategoryId | null;
  amount: number;
};

export type CategoryTotal = {
  /** `null` = sin_clasificar. Distinto de `otros`, que es un id normal (`AC-CAT-01`). */
  category_id: CategoryId | null;
  total: number;
  movement_count: number;
};

/**
 * Agrega montos por categoría para el periodo ya filtrado por el llamador.
 * `sin_clasificar` (`category_id: null`) y `otros` nunca se mezclan.
 */
export function aggregateCategoryTotals(
  movements: CategoryTotalsInputMovement[]
): CategoryTotal[] {
  const totals = new Map<CategoryId | null, { total: number; count: number }>();

  for (const movement of movements) {
    if (CATEGORY_EXCLUDED_MOVEMENT_TYPES.includes(movement.type)) continue;

    const current = totals.get(movement.category_id) ?? { total: 0, count: 0 };
    current.total += movement.amount;
    current.count += 1;
    totals.set(movement.category_id, current);
  }

  return [...totals.entries()].map(([categoryId, value]) => ({
    category_id: categoryId,
    total: normalizeMovementAmount(value.total),
    movement_count: value.count,
  }));
}

export type SubcategoryCount = {
  subcategory_id: string;
  movement_count: number;
};

/**
 * Conteo de movimientos por subcategoria, mismo periodo y misma exclusion
 * de tipos que `aggregateCategoryTotals` (SCR-CAT-02/03: "conteo de
 * movimientos", "las mas usadas primero").
 */
export function aggregateSubcategoryCounts(
  movements: Array<{ type: MovementType; subcategory_id: string | null }>
): SubcategoryCount[] {
  const counts = new Map<string, number>();

  for (const movement of movements) {
    if (!movement.subcategory_id) continue;
    if (CATEGORY_EXCLUDED_MOVEMENT_TYPES.includes(movement.type)) continue;
    counts.set(movement.subcategory_id, (counts.get(movement.subcategory_id) ?? 0) + 1);
  }

  return [...counts.entries()].map(([subcategory_id, movement_count]) => ({
    subcategory_id,
    movement_count,
  }));
}
