import type { DebtDirection } from "@/shared/types/domain";
import type { ProvenanceData, ProvenanceRow } from "@/ui/domain/provenance-panel";
import type { DebtDetailWithPayments, DebtWithPerson } from "./debts-types";
import { formatDebtMoney, OPEN_DEBT_STATUSES } from "./debts-view-model";

// `48` `RUL-AYUDA-01` sobre `13` — el saldo pendiente es `principal − pagado`
// (`toDebtViewItem`, que lee `debt.current_balance` del registro). Las filas
// son los pagos que lo componen; un pago revertido no afecta el saldo, así
// que aparece en "qué no conté", nunca en la resta (`RUL-AYUDA-02`).

export function buildDebtProvenance(debt: DebtDetailWithPayments): ProvenanceData {
  const currency = debt.currency;
  const active = debt.payments.filter((p) => !p.reversed_at);
  const reversed = debt.payments.filter((p) => p.reversed_at);
  const paidAmount = Number(debt.principal_amount) - Number(debt.current_balance);

  const rows: ProvenanceRow[] = [...active]
    .sort((a, b) => b.paid_at.localeCompare(a.paid_at))
    .map((payment) => ({
      id: payment.id,
      label: `Pago del ${new Date(payment.paid_at).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}`,
      detail: payment.source,
      amount: payment.amount,
      href: payment.movement_id ? `/movimientos/${payment.movement_id}` : undefined,
    }));

  return {
    title: `De dónde sale este saldo pendiente de ${formatDebtMoney(Number(debt.current_balance), currency)}`,
    countedLines: [
      `${formatDebtMoney(Number(debt.principal_amount), currency)} originales`,
      `menos ${formatDebtMoney(paidAmount, currency)} pagados en ${active.length} ${active.length === 1 ? "pago" : "pagos"}`,
    ],
    notCounted:
      reversed.length > 0
        ? [{ text: `${reversed.length} ${reversed.length === 1 ? "pago revertido" : "pagos revertidos"}, no afectan el saldo` }]
        : [],
    rowsTitle: `Los ${active.length} ${active.length === 1 ? "pago" : "pagos"}`,
    rows,
  };
}

/** Fila de la lista (`debts-screen.tsx`): solo trae `DebtWithPerson`, sin
 * pagos — se resuelve con la misma llamada que abre el detalle. */
export function debtProvenanceAriaLabel(debt: DebtWithPerson): string {
  return `Ver de dónde sale este saldo pendiente de ${debt.name}`;
}

/** Total bruto por dirección (`DebtSummaryCards`): mismo filtro que
 * `summarizeDebts` (`OPEN_DEBT_STATUSES`, sin mezclar monedas), sin
 * recalcularlo — sus filas son las deudas, un nivel a la vez (`48` caso
 * borde 1). */
export function buildDebtsSummaryProvenance(
  debts: DebtWithPerson[],
  direction: DebtDirection,
): ProvenanceData {
  const active = debts.filter(
    (d) => OPEN_DEBT_STATUSES.has(d.status) && d.direction === direction && d.currency === "PEN",
  );
  const total = active.reduce((sum, d) => sum + Number(d.current_balance), 0);
  const label = direction === "i_owe" ? "Lo que debes" : "Lo que te deben";

  return {
    title: `De dónde sale este ${formatDebtMoney(total)}`,
    countedLines: [`${active.length} ${active.length === 1 ? "deuda activa" : "deudas activas"} de ${label.toLowerCase()}`],
    notCounted: [],
    rowsTitle: "Las deudas",
    rows: active.map<ProvenanceRow>((d) => ({
      id: d.id,
      label: d.name,
      detail: d.related_person?.display_name ?? undefined,
      amount: Number(d.current_balance),
      href: `/deudas/${d.id}`,
    })),
  };
}
