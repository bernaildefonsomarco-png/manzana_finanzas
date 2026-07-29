import type { MovementInput } from "@/shared/schemas/money";
import { CoreError } from "./errors";

export type BalanceDelta = {
  account_id: string;
  delta: number;
};

export type BoxBalanceDelta = {
  box_id: string;
  delta: number;
};

export type MovementBalanceEffect = {
  accountDeltas: BalanceDelta[];
  boxDeltas: BoxBalanceDelta[];
  affectsTotalBalance: boolean;
  affectsAccountBalance: boolean;
};

export function normalizeMovementAmount(amount: number): number {
  return Math.round(amount * 100) / 100;
}

function requireAmount(input: MovementInput): number {
  // WEB-D197: "ajuste" es el unico tipo que puede llevar monto negativo
  // (26_modulo_movimientos.md §4.1/§7) porque el signo es la unica senal de
  // si el saldo sube o baja; el resto de tipos exige monto positivo.
  const { amount } = input;
  const isValid =
    amount != null && (input.type === "ajuste" ? amount !== 0 : amount > 0);

  if (!isValid || amount == null) {
    throw new CoreError(
      "INVALID_MOVEMENT_AMOUNT",
      input.type === "ajuste"
        ? "El ajuste necesita un monto distinto de cero"
        : "El movimiento confirmado necesita un monto mayor a cero"
    );
  }

  return normalizeMovementAmount(amount);
}

function addAccountDelta(
  deltas: BalanceDelta[],
  accountId: string | null,
  delta: number
): void {
  if (!accountId) return;
  deltas.push({ account_id: accountId, delta: normalizeMovementAmount(delta) });
}

function addBoxDelta(
  deltas: BoxBalanceDelta[],
  boxId: string | null,
  delta: number
): void {
  if (!boxId) return;
  deltas.push({ box_id: boxId, delta: normalizeMovementAmount(delta) });
}

function hasAnyAccount(input: MovementInput): boolean {
  return Boolean(input.account_origin_id || input.account_destination_id);
}

export function calculateMovementBalanceEffect(
  input: MovementInput
): MovementBalanceEffect {
  const amount = requireAmount(input);
  const accountDeltas: BalanceDelta[] = [];
  const boxDeltas: BoxBalanceDelta[] = [];

  switch (input.type) {
    case "gasto":
    case "pago_deuda":
    case "prestamo_dado":
    case "pago_recurrente": {
      addAccountDelta(accountDeltas, input.account_origin_id, -amount);
      addBoxDelta(boxDeltas, input.box_origin_id, -amount);
      break;
    }

    case "ingreso":
    case "prestamo_recibido":
    case "devolucion_recibida": {
      addAccountDelta(accountDeltas, input.account_destination_id, amount);
      addBoxDelta(boxDeltas, input.box_destination_id, amount);
      break;
    }

    case "transferencia": {
      if (!input.account_origin_id || !input.account_destination_id) {
        throw new CoreError(
          "INVALID_MOVEMENT_ACCOUNTS",
          "Una transferencia necesita cuenta origen y destino"
        );
      }

      if (input.account_origin_id === input.account_destination_id) {
        throw new CoreError(
          "INVALID_MOVEMENT_ACCOUNTS",
          "La cuenta origen y destino no pueden ser la misma"
        );
      }

      addAccountDelta(accountDeltas, input.account_origin_id, -amount);
      addAccountDelta(accountDeltas, input.account_destination_id, amount);
      break;
    }

    case "asignacion_interna": {
      if (!input.box_origin_id && !input.box_destination_id) {
        throw new CoreError(
          "INVALID_MOVEMENT_BOXES",
          "Una asignacion interna necesita al menos una caja origen o destino"
        );
      }

      if (
        input.box_origin_id &&
        input.box_destination_id &&
        input.box_origin_id === input.box_destination_id
      ) {
        throw new CoreError(
          "INVALID_MOVEMENT_BOXES",
          "La caja origen y destino no pueden ser la misma"
        );
      }

      addBoxDelta(boxDeltas, input.box_origin_id, -amount);
      addBoxDelta(boxDeltas, input.box_destination_id, amount);
      break;
    }

    case "deuda_adquirida": {
      break;
    }

    case "ajuste": {
      const reason = input.metadata["reason"];
      if (typeof reason !== "string" || reason.trim().length === 0) {
        throw new CoreError(
          "INVALID_ADJUSTMENT",
          "Un ajuste requiere motivo en metadata.reason"
        );
      }

      // WEB-D197: "cuenta" de un ajuste es siempre el destino; el signo del
      // monto (ya validado por requireAmount) es la unica senal de si sube
      // o baja. Usar el origen duplicaria esa senal con un segundo signo.
      if (
        input.account_origin_id ||
        input.box_origin_id ||
        input.box_destination_id
      ) {
        throw new CoreError(
          "INVALID_MOVEMENT_ACCOUNTS",
          "Un ajuste solo usa la cuenta como destino"
        );
      }
      if (!input.account_destination_id) {
        throw new CoreError(
          "INVALID_MOVEMENT_ACCOUNTS",
          "Un ajuste necesita una cuenta"
        );
      }

      addAccountDelta(accountDeltas, input.account_destination_id, amount);
      break;
    }
  }

  const affectsAccountBalance =
    accountDeltas.length > 0 || boxDeltas.length > 0;
  const affectsTotalBalance =
    hasAnyAccount(input) &&
    input.type !== "transferencia" &&
    input.type !== "asignacion_interna";

  return {
    accountDeltas,
    boxDeltas,
    affectsTotalBalance,
    affectsAccountBalance,
  };
}

export function reverseBalanceEffect(
  effect: MovementBalanceEffect
): MovementBalanceEffect {
  return {
    accountDeltas: effect.accountDeltas.map((delta) => ({
      ...delta,
      delta: normalizeMovementAmount(-delta.delta),
    })),
    boxDeltas: effect.boxDeltas.map((delta) => ({
      ...delta,
      delta: normalizeMovementAmount(-delta.delta),
    })),
    affectsTotalBalance: effect.affectsTotalBalance,
    affectsAccountBalance: effect.affectsAccountBalance,
  };
}

export function combineBalanceEffects(
  ...effects: MovementBalanceEffect[]
): MovementBalanceEffect {
  return {
    accountDeltas: effects.flatMap((effect) => effect.accountDeltas),
    boxDeltas: effects.flatMap((effect) => effect.boxDeltas),
    affectsTotalBalance: effects.some((effect) => effect.affectsTotalBalance),
    affectsAccountBalance: effects.some(
      (effect) => effect.affectsAccountBalance
    ),
  };
}

