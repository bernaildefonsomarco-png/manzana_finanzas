import { normalizeMovementAmount } from "./balance-engine";

/**
 * Las cuatro capas del dinero (`09_modelo_mental_dinero.md` §2-3,
 * `24_modulo_cuentas_y_cajas.md` §6 RUL-CUENTAS-01 a 04). Unica fuente de
 * este calculo: cualquier pantalla o consulta que muestre dinero libre pasa
 * por aqui, para que RUL-CUENTAS-04 (sin doble descuento) se cumpla en un
 * solo lugar en vez de reimplementarse por pantalla.
 */

export type MoneyLayersAccount = {
  current_balance: number;
};

export type MoneyLayersBox = {
  id: string;
  current_balance: number;
};

/**
 * Un compromiso proximo. `linked_box_id` referencia una caja de la misma
 * lista de `boxes` pasada a `calculateMoneyLayers`; si no hay caja que lo
 * cubra (o la caja no aparece en la lista, p. ej. porque esta archivada),
 * el compromiso completo cuenta como no cubierto.
 *
 * Nota de alcance: hoy solo los compromisos recurrentes (`recurring_rules
 * .linked_box_id`) llegan aqui con una caja vinculada. Los compromisos de
 * deuda podrian cubrirse por una caja via `boxes.linked_debt_id`
 * (`24` §4.2), pero esa cobertura no esta cableada todavia — es del
 * dominio de `31_modulo_deudas.md` ("sin doble descuento", dueño `W-11`),
 * no de este corte.
 */
export type MoneyLayersCommitment = {
  amount: number;
  linked_box_id: string | null;
};

export type MoneyLayers = {
  /** Capa 1: suma de saldos de cuentas activas ("Dinero total"). */
  total_balance: number;
  /** Suma de saldos de cajas activas ("Separado"). */
  separated_in_boxes: number;
  /** Capa 2: total menos separado ("Libre en cuentas"). */
  free_in_accounts: number;
  /** Compromisos proximos que ninguna caja cubre, tras descontar cobertura parcial. */
  upcoming_uncovered_commitments: number;
  /** Capa 3: libre en cuentas menos compromisos no cubiertos ("Dinero libre"). */
  operational_free_money: number;
};

/**
 * `RUL-CUENTAS-01` a `04`: calcula las cuatro capas sin doble conteo. Un
 * compromiso con caja vinculada solo descuenta la diferencia entre su monto
 * y el saldo de esa caja (cobertura parcial); si la caja cubre el monto
 * completo, el compromiso no descuenta nada.
 */
export function calculateMoneyLayers(params: {
  accounts: MoneyLayersAccount[];
  boxes: MoneyLayersBox[];
  commitments: MoneyLayersCommitment[];
}): MoneyLayers {
  const { accounts, boxes, commitments } = params;

  const totalBalance = sum(accounts.map((account) => account.current_balance));
  const separatedInBoxes = sum(boxes.map((box) => box.current_balance));
  const freeInAccounts = totalBalance - separatedInBoxes;

  const boxById = new Map(boxes.map((box) => [box.id, box]));
  const upcomingUncoveredCommitments = sum(
    commitments.map((commitment) => {
      const coveringBox = commitment.linked_box_id
        ? boxById.get(commitment.linked_box_id)
        : undefined;
      const covered = coveringBox
        ? Math.min(commitment.amount, Math.max(0, coveringBox.current_balance))
        : 0;
      return Math.max(0, commitment.amount - covered);
    })
  );

  return {
    total_balance: normalizeMovementAmount(totalBalance),
    separated_in_boxes: normalizeMovementAmount(separatedInBoxes),
    free_in_accounts: normalizeMovementAmount(freeInAccounts),
    upcoming_uncovered_commitments: normalizeMovementAmount(upcomingUncoveredCommitments),
    operational_free_money: normalizeMovementAmount(freeInAccounts - upcomingUncoveredCommitments),
  };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** `09_modelo_mental_dinero.md` §7: horizonte de compromisos proximos. */
export const COMMITMENT_HORIZON_DAYS = 30;
