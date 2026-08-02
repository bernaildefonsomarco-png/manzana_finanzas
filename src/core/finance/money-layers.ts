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
 * Recurrentes y cuotas de deuda llegan con la caja resuelta por sus
 * repositorios. Si varios compromisos apuntan a la misma caja, el saldo de
 * esa reserva se consume virtualmente una sola vez y en orden de vencimiento
 * (`WEB-D206`).
 */
export type MoneyLayersCommitment = {
  id?: string;
  amount: number;
  linked_box_id: string | null;
  due_at?: string;
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

  // WEB-D206: una caja representa una sola reserva. Su saldo se consume
  // virtualmente una vez, por vencimiento estable, en vez de volver a usar
  // el saldo completo para cada compromiso vinculado.
  const remainingByBoxId = new Map(
    boxes.map((box) => [box.id, Math.max(0, box.current_balance)])
  );
  const upcomingUncoveredCommitments = sum(
    [...commitments]
      .sort(compareCommitmentsForCoverage)
      .map((commitment) => {
        const remaining = commitment.linked_box_id
          ? remainingByBoxId.get(commitment.linked_box_id)
          : undefined;
        const covered =
          remaining === undefined
            ? 0
            : Math.min(commitment.amount, remaining);
        if (commitment.linked_box_id && remaining !== undefined) {
          remainingByBoxId.set(
            commitment.linked_box_id,
            normalizeMovementAmount(remaining - covered)
          );
        }
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

function compareCommitmentsForCoverage(
  left: MoneyLayersCommitment,
  right: MoneyLayersCommitment
): number {
  const byDate = (left.due_at ?? "9999-12-31").localeCompare(
    right.due_at ?? "9999-12-31"
  );
  if (byDate !== 0) return byDate;
  return (left.id ?? "").localeCompare(right.id ?? "");
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

/** `09_modelo_mental_dinero.md` §7: horizonte de compromisos proximos. */
export const COMMITMENT_HORIZON_DAYS = 30;

export type MoneyLayersCurrencyAccount = {
  id: string;
  current_balance: number;
  currency: string;
};
export type MoneyLayersCurrencyBox = {
  id: string;
  account_id: string;
  current_balance: number;
};
export type MoneyLayersCurrencyCommitment = {
  id?: string;
  amount: number;
  linked_box_id: string | null;
  due_at?: string;
  currency: string;
};

/**
 * Filtra cuentas, cajas y compromisos a una sola moneda y calcula sus capas
 * (`RUL-CUENTAS-01` a `04`). Extraida de `/api/v1/money` para que el Inicio
 * (`39` `RUL-HOME-01/02`) llame exactamente esta misma funcion en vez de
 * reimplementar el filtro por moneda: el dinero libre del Inicio, el de Mi
 * Dinero y el que responde el asistente deben salir de la misma llamada.
 */
export function calculateMoneyLayersForCurrency(
  currency: "PEN" | "USD",
  accounts: MoneyLayersCurrencyAccount[],
  boxes: MoneyLayersCurrencyBox[],
  commitments: MoneyLayersCurrencyCommitment[]
): MoneyLayers {
  const currencyAccounts = accounts.filter((account) => account.currency === currency);
  const accountIds = new Set(currencyAccounts.map((account) => account.id));
  const currencyBoxes = boxes.filter((box) => accountIds.has(box.account_id));

  return calculateMoneyLayers({
    accounts: currencyAccounts.map((account) => ({
      current_balance: account.current_balance,
    })),
    boxes: currencyBoxes.map((box) => ({ id: box.id, current_balance: box.current_balance })),
    commitments: commitments
      .filter((commitment) => commitment.currency === currency)
      .map((commitment) => ({
        id: commitment.id,
        amount: commitment.amount,
        linked_box_id: commitment.linked_box_id,
        due_at: commitment.due_at,
      })),
  });
}
