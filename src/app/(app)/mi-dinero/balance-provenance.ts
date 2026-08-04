import { listMovementsFiltered } from "@/features/movements/movements-api";
import type { Movement } from "@/shared/types/domain";
import type { ProvenanceData, ProvenanceRow } from "@/ui/domain/provenance-panel";

// `48` `RUL-AYUDA-01` sobre `09` — el saldo de una cuenta o caja es un
// balance corriente (saldo inicial + cada movimiento desde entonces), no
// una suma que quepa mostrar completa sin límite. Por honestidad
// (`RUL-HECHO-04`: no fingir una lista completa que no lo es), las filas
// se declaran explícitamente como "los últimos N", nunca como el total.

const RECENT_LIMIT = 20;

function formatMoney(value: number, currency: "PEN" | "USD"): string {
  return new Intl.NumberFormat("es-PE", { style: "currency", currency, minimumFractionDigits: 2 })
    .format(value)
    .replace(/^(\D+)\s+/, "$1");
}

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

function rowsTitle(count: number): string {
  return count >= RECENT_LIMIT ? `Los últimos ${count} movimientos` : `Los ${count} movimientos`;
}

export async function loadAccountBalanceProvenance(params: {
  accountId: string;
  currentBalance: number;
  initialBalance: number;
  currency: "PEN" | "USD";
}): Promise<ProvenanceData> {
  const movements = await listMovementsFiltered({ account_id: params.accountId, limit: RECENT_LIMIT });
  return {
    title: `De dónde sale este saldo de ${formatMoney(params.currentBalance, params.currency)}`,
    countedLines: [
      `${formatMoney(params.initialBalance, params.currency)} de saldo inicial declarado`,
      "más los movimientos de esta cuenta",
    ],
    notCounted: [],
    rowsTitle: rowsTitle(movements.length),
    rows: toRows(movements),
  };
}

export async function loadBoxBalanceProvenance(params: {
  boxId: string;
  currentBalance: number;
  currency: "PEN" | "USD";
}): Promise<ProvenanceData> {
  const movements = await listMovementsFiltered({ box_id: params.boxId, limit: RECENT_LIMIT });
  return {
    title: `De dónde sale este apartado de ${formatMoney(params.currentBalance, params.currency)}`,
    countedLines: ["Lo que entró y salió de esta caja desde que la creaste"],
    notCounted: [],
    rowsTitle: rowsTitle(movements.length),
    rows: toRows(movements),
  };
}
