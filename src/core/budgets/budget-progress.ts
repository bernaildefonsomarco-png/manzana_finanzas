import type { CategoryId } from "@/shared/types/domain";
import {
  centsToMoney,
  moneyToCents,
  requirePositiveMoney,
} from "./money";
import {
  BUDGET_ACTIVE_MOVEMENT_STATUSES,
  type BudgetKind,
  type BudgetMovement,
  type BudgetProgress,
  type BudgetProgressBand,
} from "./types";

const ACTIVE_STATUSES = new Set<string>(BUDGET_ACTIVE_MOVEMENT_STATUSES);

/**
 * `RUL-PRES-01`: un presupuesto es una referencia. Su efecto sobre dinero
 * libre y saldos siempre es cero; reservar dinero pertenece a Cajas.
 */
export function calculateBudgetFreeMoneyEffect(_budgetAmount: number): 0 {
  return 0;
}

/** `RUL-PRES-04`: ni siquiera el limite estricto bloquea un gasto. */
export function budgetKindBlocksSpending(_kind: BudgetKind): false {
  return false;
}

export function movementCountsForBudget(
  movement: BudgetMovement,
  budgetCategoryId: CategoryId | null
): boolean {
  if (movement.currency !== "PEN") return false;
  if (!ACTIVE_STATUSES.has(movement.status)) return false;
  if (movement.deleted_at) return false;

  if (movement.type === "pago_deuda") {
    if (movement.category_id !== "deudas") return false;
    return budgetCategoryId === null || budgetCategoryId === "deudas";
  }

  if (
    movement.type !== "gasto" &&
    movement.type !== "pago_recurrente"
  ) {
    return false;
  }

  return (
    budgetCategoryId === null || movement.category_id === budgetCategoryId
  );
}

export function calculateBudgetProgress(input: {
  amount: number;
  category_id: CategoryId | null;
  movements: BudgetMovement[];
}): BudgetProgress {
  const amountCents = requirePositiveMoney(input.amount, "presupuesto");
  const counted = input.movements.filter((movement) =>
    movementCountsForBudget(movement, input.category_id)
  );
  const spentCents = counted.reduce(
    (total, movement) => total + moneyToCents(movement.amount, "movimiento"),
    0
  );
  const percentageExact = (spentCents * 100) / amountCents;

  return {
    spent: centsToMoney(spentCents),
    remaining: centsToMoney(amountCents - spentCents),
    pct: Math.round((spentCents / amountCents) * 10_000) / 10_000,
    percentage: Math.round(percentageExact),
    percentage_exact: percentageExact,
    band: resolveBudgetProgressBandFromCents(spentCents, amountCents),
    movement_ids: counted.map((movement) => movement.id),
  };
}

export function resolveBudgetProgressBand(
  spent: number,
  amount: number
): BudgetProgressBand {
  return resolveBudgetProgressBandFromCents(
    moneyToCents(spent, "gastado"),
    requirePositiveMoney(amount, "presupuesto")
  );
}

function resolveBudgetProgressBandFromCents(
  spentCents: number,
  amountCents: number
): BudgetProgressBand {
  if (spentCents * 100 >= amountCents * 100) return "superado";
  if (spentCents * 100 >= amountCents * 90) return "cerca";
  if (spentCents * 100 >= amountCents * 70) return "atencion";
  return "holgado";
}
