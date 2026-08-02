import type { CategoryId } from "@/shared/types/domain";
import {
  movementCountsForBudget,
} from "@/core/budgets/budget-progress";
import { centsToMoney, moneyToCents } from "@/core/budgets/money";
import type { BudgetMovement } from "@/core/budgets/types";

// RUL-REP-01: "el gasto de Alimentación en julio debe dar exactamente el
// mismo número en el reporte, en la pantalla de presupuestos y en la
// respuesta del asistente" — se logra reutilizando `movementCountsForBudget`
// (el mismo filtro que usa el Budget Engine), nunca reimplementándolo.

export type ReportMovement = BudgetMovement;

export type ReportCategoryTotal = {
  category_id: CategoryId | null;
  total: number;
  movement_count: number;
};

export type ReportExclusionReason =
  | "transferencia"
  | "asignacion_interna"
  | "ajuste"
  | "prestamo"
  | "devolucion"
  | "pendiente_sin_confirmar"
  | "otra_moneda";

export type ReportExclusion = {
  reason: ReportExclusionReason;
  count: number;
};

export type ReportPeriodResult = {
  gastoTotal: number;
  ingresoTotal: number;
  gastoMovementCount: number;
  ingresoMovementCount: number;
  byCategory: ReportCategoryTotal[];
  exclusions: ReportExclusion[];
  countedMovementIds: string[];
};

const exclusionReasonByType: Partial<Record<ReportMovement["type"], ReportExclusionReason>> = {
  transferencia: "transferencia",
  asignacion_interna: "asignacion_interna",
  ajuste: "ajuste",
  prestamo_dado: "prestamo",
  prestamo_recibido: "prestamo",
  devolucion_recibida: "devolucion",
};

/**
 * RUL-REP-01/RUL-REP-02: agrega el gasto por categoría reutilizando el
 * mismo filtro que Presupuestos, calcula el ingreso del periodo con el
 * mismo criterio de estado/moneda, y declara qué quedó fuera y por qué.
 */
export function computeReportPeriod(input: {
  movements: ReportMovement[];
  pendingUnconfirmedCount?: number;
}): ReportPeriodResult {
  const byCategory = new Map<CategoryId | null, { totalCents: number; count: number }>();
  const exclusionCounts = new Map<ReportExclusionReason, number>();
  const countedIds: string[] = [];
  let gastoCents = 0;
  let gastoCount = 0;
  let ingresoCents = 0;
  let ingresoCount = 0;

  for (const movement of input.movements) {
    if (movement.currency !== "PEN") {
      exclusionCounts.set("otra_moneda", (exclusionCounts.get("otra_moneda") ?? 0) + 1);
      continue;
    }

    if (movement.type === "ingreso") {
      if (movementIsActive(movement)) {
        ingresoCents += moneyToCents(movement.amount, "movimiento");
        ingresoCount += 1;
        countedIds.push(movement.id);
      }
      continue;
    }

    if (movementCountsForBudget(movement, null)) {
      const cents = moneyToCents(movement.amount, "movimiento");
      gastoCents += cents;
      gastoCount += 1;
      countedIds.push(movement.id);

      const current = byCategory.get(movement.category_id) ?? { totalCents: 0, count: 0 };
      current.totalCents += cents;
      current.count += 1;
      byCategory.set(movement.category_id, current);
      continue;
    }

    const reason = exclusionReasonByType[movement.type];
    if (reason) {
      exclusionCounts.set(reason, (exclusionCounts.get(reason) ?? 0) + 1);
    }
  }

  if (input.pendingUnconfirmedCount && input.pendingUnconfirmedCount > 0) {
    exclusionCounts.set("pendiente_sin_confirmar", input.pendingUnconfirmedCount);
  }

  return {
    gastoTotal: centsToMoney(gastoCents),
    ingresoTotal: centsToMoney(ingresoCents),
    gastoMovementCount: gastoCount,
    ingresoMovementCount: ingresoCount,
    byCategory: [...byCategory.entries()]
      .map(([category_id, value]) => ({
        category_id,
        total: centsToMoney(value.totalCents),
        movement_count: value.count,
      }))
      .sort((a, b) => b.total - a.total),
    exclusions: [...exclusionCounts.entries()].map(([reason, count]) => ({ reason, count })),
    countedMovementIds: countedIds,
  };
}

function movementIsActive(movement: ReportMovement): boolean {
  return (
    !movement.deleted_at &&
    (movement.status === "confirmed" ||
      movement.status === "needs_review" ||
      movement.status === "corrected")
  );
}

export type ReportComparison = {
  currentTotal: number;
  previousTotal: number;
  differenceAbsolute: number;
  differenceRelative: number | null;
  byCategory: Array<{
    category_id: CategoryId | null;
    current: number;
    previous: number;
    differenceAbsolute: number;
  }>;
};

/**
 * RUL-REP-04: compara dos periodos ya agregados por `computeReportPeriod`.
 * No normaliza por longitud de periodo: eso es una decisión de análisis que
 * `RUL-REP-04` prohíbe tomar en silencio.
 */
export function compareReportPeriods(
  current: ReportPeriodResult,
  previous: ReportPeriodResult,
): ReportComparison {
  const categoryIds = new Set<CategoryId | null>([
    ...current.byCategory.map((c) => c.category_id),
    ...previous.byCategory.map((c) => c.category_id),
  ]);

  const byCategory = [...categoryIds].map((categoryId) => {
    const currentEntry = current.byCategory.find((c) => c.category_id === categoryId);
    const previousEntry = previous.byCategory.find((c) => c.category_id === categoryId);
    const currentTotal = currentEntry?.total ?? 0;
    const previousTotal = previousEntry?.total ?? 0;
    return {
      category_id: categoryId,
      current: currentTotal,
      previous: previousTotal,
      differenceAbsolute: centsToMoney(
        moneyToCents(currentTotal, "movimiento") - moneyToCents(previousTotal, "movimiento"),
      ),
    };
  });

  return {
    currentTotal: current.gastoTotal,
    previousTotal: previous.gastoTotal,
    differenceAbsolute: centsToMoney(
      moneyToCents(current.gastoTotal, "movimiento") - moneyToCents(previous.gastoTotal, "movimiento"),
    ),
    differenceRelative:
      previous.gastoTotal > 0
        ? Math.round(
            ((current.gastoTotal - previous.gastoTotal) / previous.gastoTotal) * 10_000,
          ) / 10_000
        : null,
    byCategory: byCategory.sort((a, b) => Math.abs(b.differenceAbsolute) - Math.abs(a.differenceAbsolute)),
  };
}

// RUL-REP-05: los cinco gráficos, y cuándo cada uno aplica (ninguno se
// dibuja si su decisión no aplica).
export type ReportChartKind =
  | "barras_categoria"
  | "linea_evolucion"
  | "barras_comparadas"
  | "ingreso_vs_gasto"
  | "barras_apiladas_cuenta";

export function applicableCharts(input: {
  hasComparison: boolean;
  hasIngresos: boolean;
  hasMultipleAccounts: boolean;
  hasSeveralPeriodsForEvolution: boolean;
}): ReportChartKind[] {
  const charts: ReportChartKind[] = ["barras_categoria"];
  if (input.hasSeveralPeriodsForEvolution) charts.push("linea_evolucion");
  if (input.hasComparison) charts.push("barras_comparadas");
  if (input.hasIngresos) charts.push("ingreso_vs_gasto");
  if (input.hasMultipleAccounts) charts.push("barras_apiladas_cuenta");
  return charts;
}

// RUL-REP-03: los mismos periodos de toda la app (idénticos a RUL-PRES-09),
// en America/Lima. "valor" es AAAA-MM para mes, AAAA-Www o una fecha del
// rango para semana/quincena.
export type ReportPeriodKind = "semana" | "quincena" | "mes" | "rango";

export function resolveReportPeriodBounds(
  kind: ReportPeriodKind,
  value: string,
  explicitTo?: string,
): { from: string; to: string } {
  if (kind === "mes") {
    const [year, month] = value.split("-").map(Number) as [number, number];
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      from: `${value}-01`,
      to: `${value}-${String(lastDay).padStart(2, "0")}`,
    };
  }

  if (kind === "quincena") {
    // value: "2026-07-1" o "2026-07-2" (primera/segunda quincena)
    const [year, month, half] = value.split("-").map(Number) as [number, number, number];
    if (half === 1) {
      return { from: isoDate(year, month, 1), to: isoDate(year, month, 15) };
    }
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return { from: isoDate(year, month, 16), to: isoDate(year, month, lastDay) };
  }

  if (kind === "semana") {
    // value: cualquier fecha AAAA-MM-DD dentro de la semana deseada.
    const date = new Date(`${value}T12:00:00Z`);
    const dow = date.getUTCDay();
    const isoDow = dow === 0 ? 7 : dow;
    const monday = new Date(date.getTime() - (isoDow - 1) * 86_400_000);
    const sunday = new Date(monday.getTime() + 6 * 86_400_000);
    return { from: monday.toISOString().slice(0, 10), to: sunday.toISOString().slice(0, 10) };
  }

  // rango: value = desde, explicitTo = hasta
  return { from: value, to: explicitTo ?? value };
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// RUL-REP-05: máximo 5 barras + "Otras (n)" agrupando la cola.
export function topCategoriesWithOthers(
  categories: ReportCategoryTotal[],
  maxBars = 5,
): { top: ReportCategoryTotal[]; othersTotal: number; othersCount: number } {
  const sorted = [...categories].sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, maxBars);
  const rest = sorted.slice(maxBars);
  const othersTotal = centsToMoney(
    rest.reduce((sum, c) => sum + moneyToCents(c.total, "movimiento"), 0),
  );
  const othersCount = rest.reduce((sum, c) => sum + c.movement_count, 0);
  return { top, othersTotal, othersCount };
}
