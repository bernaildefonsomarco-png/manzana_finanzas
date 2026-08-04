import type { MoneyDashboardResponse } from "@/shared/api/money-types";
import type { ProvenanceData } from "@/ui/domain/provenance-panel";

// `48` `RUL-AYUDA-01`/`RUL-AYUDA-02` — la procedencia real de "Tienes
// libres" (`39` `SCR-HOME-01`). `home.free_balance` y
// `money.operational_free_money` son el mismo número, verificado por
// `src/app/api/v1/home/free-money-identity.test.ts`: esta función explica
// exactamente la cifra que la pantalla ya muestra, no una aproximación.
// La fórmula (`src/core/finance/money-layers.ts`):
// `operational_free_money = free_in_accounts - upcoming_uncovered_commitments`
// `free_in_accounts = total_balance - separated_in_boxes`.
export function buildFreeMoneyProvenance(dashboard: MoneyDashboardResponse): ProvenanceData {
  const formatMoney = (value: number) =>
    new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 2 })
      .format(value)
      .replace(/^(\D+)\s+/, "$1");

  const countedLines = [
    `${formatMoney(dashboard.total_balance)} en tus ${dashboard.accounts.length} ${dashboard.accounts.length === 1 ? "cuenta" : "cuentas"}`,
    `− ${formatMoney(dashboard.separated_in_boxes)} apartados en ${dashboard.boxes.length} ${dashboard.boxes.length === 1 ? "caja" : "cajas"}`,
  ];
  if (dashboard.upcoming_uncovered_commitments > 0) {
    countedLines.push(
      `− ${formatMoney(dashboard.upcoming_uncovered_commitments)} en compromisos que vienen sin una caja que los cubra`,
    );
  }

  const notCounted = [];
  const usdBalance = dashboard.currency_layers.USD?.total_balance ?? 0;
  if (usdBalance !== 0) {
    notCounted.push({
      text: "Tus cuentas en dólares no se suman aquí: no convierto monedas sin un tipo de cambio explícito.",
    });
  }

  const rows = [
    ...dashboard.accounts.map((account) => ({
      id: `account-${account.id}`,
      label: account.name,
      detail: "Cuenta",
      amount: account.free_balance,
      href: `/mi-dinero/cuentas/${account.id}`,
    })),
    ...dashboard.boxes.map((box) => ({
      id: `box-${box.id}`,
      label: box.name,
      detail: `Caja en ${box.account_name}`,
      amount: box.current_balance,
      href: `/mi-dinero/cajas/${box.id}`,
    })),
    ...(dashboard.upcoming_uncovered_commitments > 0
      ? dashboard.commitments
          .filter((commitment) => !commitment.linked_box_id)
          .map((commitment) => ({
            id: `commitment-${commitment.id}`,
            label: commitment.title,
            detail: "Compromiso sin caja que lo cubra",
            amount: commitment.amount,
            href: "/pagos-que-vienen",
          }))
      : []),
  ];

  return {
    title: `De dónde sale este ${formatMoney(dashboard.operational_free_money)}`,
    countedLines,
    notCounted,
    rowsTitle: "Cuentas, cajas y compromisos",
    rows,
  };
}
