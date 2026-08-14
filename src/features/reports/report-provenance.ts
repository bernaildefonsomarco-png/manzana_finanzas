import { listMovementsFiltered } from "@/features/movements/movements-api";
import { getCategoryLabel } from "@/shared/copy/category-copy";
import type { Movement } from "@/shared/types/domain";
import type { ProvenanceData, ProvenanceNotCountedItem, ProvenanceRow } from "@/ui/domain/provenance-panel";
import type { ReportPeriod } from "./reports-api";

// `48` `RUL-AYUDA-01`/`RUL-AYUDA-02`, `35` §10 — la procedencia del gasto de
// un periodo y de cada categoría. `countedMovementIds` viene de la misma
// agregación que produjo el total (`computeReportPeriod`); las filas nunca
// se recalculan aquí, solo se filtran a los IDs que el motor ya contó, para
// que la cifra y su desglose no puedan desalinearse (`RUL-REP-01`).

export const EXCLUSION_LABELS: Record<string, string> = {
  transferencia: "transferencias entre tus cuentas",
  asignacion_interna: "asignaciones a cajas",
  ajuste: "ajustes de saldo",
  prestamo: "préstamos",
  devolucion: "devoluciones",
  pendiente_sin_confirmar: "pendientes que no has confirmado",
  otra_moneda: "movimientos en otra moneda",
};

function formatRange(from: string, to: string): string {
  const fmt = (value: string) =>
    new Date(`${value}T12:00:00Z`).toLocaleDateString("es-PE", { day: "numeric", month: "long" });
  return `Del ${fmt(from)} al ${fmt(to)}`;
}

function toRows(movements: Movement[]): ProvenanceRow[] {
  return [...movements]
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))
    .map((m) => ({
      id: m.id,
      label: m.merchant || m.description || getCategoryLabel(m.category_id) || "Movimiento",
      detail: new Date(m.occurred_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" }),
      amount: m.amount,
      href: `/movimientos/${m.id}`,
    }));
}

function exclusionsAsNotCounted(period: ReportPeriod): ProvenanceNotCountedItem[] {
  return period.exclusions.map((e) => ({
    text: `${e.count} ${EXCLUSION_LABELS[e.reason] ?? e.reason}`,
    ...(e.reason === "pendiente_sin_confirmar"
      ? { actionLabel: "Revisar pendientes", actionHref: "/pendientes" }
      : {}),
  }));
}

/** Procedencia del total de gasto del periodo (la cifra titular de `35`). */
export async function loadReportTotalProvenance(period: ReportPeriod): Promise<ProvenanceData> {
  const counted = new Set(period.countedMovementIds);
  const movements = await listMovementsFiltered({
    type: "gasto",
    from: `${period.from}T00:00:00Z`,
    to: `${period.to}T23:59:59Z`,
    limit: Math.max(period.gastoMovementCount, 1),
  });

  return {
    title: `De dónde sale este gasto de S/${period.gastoTotal.toFixed(2)}`,
    countedLines: [`${period.gastoMovementCount} gastos`, formatRange(period.from, period.to)],
    notCounted: exclusionsAsNotCounted(period),
    rowsTitle: `Los ${period.gastoMovementCount} movimientos`,
    rows: toRows(movements.filter((m) => counted.has(m.id))),
  };
}

/** Procedencia del total de una categoría en la tabla de `35` §10. */
export async function loadReportCategoryProvenance(
  period: ReportPeriod,
  category: ReportPeriod["byCategory"][number],
): Promise<ProvenanceData> {
  const counted = new Set(period.countedMovementIds);
  const movements = await listMovementsFiltered({
    type: "gasto",
    from: `${period.from}T00:00:00Z`,
    to: `${period.to}T23:59:59Z`,
    category_id: category.category_id ?? undefined,
    limit: Math.max(category.movement_count, 1),
  });
  const label = getCategoryLabel(category.category_id) ?? "Sin categoría";

  return {
    title: `De dónde sale este S/${category.total.toFixed(2)} de ${label}`,
    countedLines: [`${category.movement_count} gastos de ${label}`, formatRange(period.from, period.to)],
    notCounted: [],
    rowsTitle: `Los ${category.movement_count} movimientos`,
    rows: toRows(
      movements.filter((m) => counted.has(m.id) && (m.category_id ?? null) === category.category_id),
    ),
  };
}
