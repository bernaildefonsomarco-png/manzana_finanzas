import type { ProvenanceData, ProvenanceRow } from "@/ui/domain/provenance-panel";
import type { UpcomingSummary } from "./upcoming-types";
import { formatUpcomingMoney } from "./upcoming-view-model";

// `48` `RUL-AYUDA-01` sobre `29` — "Este mes" es la suma de
// `summary.month_items`, la misma lista que ya filtró `buildUpcomingViewModel`
// (`due_at` dentro del mes en curso): las filas nunca se recalculan aquí.

export function buildUpcomingSummaryProvenance(summary: UpcomingSummary, discreet: boolean): ProvenanceData {
  const rows: ProvenanceRow[] = summary.month_items.map((item) => ({
    id: item.id,
    label: discreet ? item.discreet_title : item.title,
    detail: item.due_label,
    amount: item.currency === "PEN" ? item.amount : null,
    href: item.debt_id ? `/deudas/${item.debt_id}` : item.recurring_rule_id ? `/pagos-que-vienen/${item.recurring_rule_id}` : undefined,
  }));

  const notCounted =
    summary.month_totals.USD > 0
      ? [{ text: `${formatUpcomingMoney(summary.month_totals.USD, "USD")} en dólares no se suman aquí: no convierto monedas.` }]
      : [];

  return {
    title: `De dónde sale este ${formatUpcomingMoney(summary.month_totals.PEN, "PEN")}`,
    countedLines: [`${summary.month_count} ${summary.month_count === 1 ? "compromiso" : "compromisos"} de este mes`],
    notCounted,
    rowsTitle: "Los compromisos de este mes",
    rows,
  };
}
