import type { Account, Box, Movement } from "@/shared/types/domain";
import type { MovementInput, Currency } from "@/shared/schemas/money";
import { CoreError } from "./errors";

/**
 * `24` §9 (`ACT-CUENTAS-10` a `13`): las cuatro operaciones que mueven dinero
 * entre cuentas y cajas del propio usuario, sin crear ni destruir saldo.
 *
 * Vive en Core y no en la ruta HTTP porque dos caminos la necesitan igual: la
 * pantalla (`src/app/api/v1/money/actions/route.ts`) y el motor conversacional
 * (`src/core/money-actions/`). Antes de este modulo la logica —tipos de
 * moneda, libre suficiente, misma cuenta para cajas— vivia solo en la ruta, y
 * el motor conversacional no podia alcanzarla: escribe directo contra
 * Supabase, no hace fetch a su propia API. Mantenerla en dos sitios habria
 * sido el mismo bug de sincronizacion que el catalogo (`40` §2) ya documenta
 * como error historico. Aqui hay una sola version de las reglas, y los dos
 * caminos llaman a la misma funcion.
 *
 * `ajustar_saldo` (`buildAdjustmentMovement`) se queda en la ruta HTTP: no
 * tiene camino conversacional en esta tanda y no comparte forma con estas
 * cuatro (no tiene origen/destino, tiene saldo objetivo).
 */

export type TransferBetweenAccountsInput = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  description?: string | null;
};

export type MoveBoxMoneyInput = {
  mode: "separate_to_box" | "release_from_box" | "box_to_box";
  amount: number;
  box_origin_id?: string | null;
  box_destination_id?: string | null;
  description?: string | null;
};

export type MoneyActionMovementReads = {
  getAccount: (accountId: string) => Promise<Account | null>;
};

export type BoxMovementReads = MoneyActionMovementReads & {
  getBox: (boxId: string) => Promise<Box | null>;
  getFreeBalance: (accountId: string) => Promise<number>;
};

export async function buildTransferMovement(params: {
  action: TransferBetweenAccountsInput;
  now: string;
  sourceRef: string;
  metadata: Record<string, unknown>;
  movementSource: Movement["source"];
  read: MoneyActionMovementReads;
}): Promise<MovementInput> {
  const [fromAccount, toAccount] = await Promise.all([
    params.read.getAccount(params.action.from_account_id),
    params.read.getAccount(params.action.to_account_id),
  ]);

  if (!fromAccount || !toAccount) {
    throw new CoreError(
      "INVALID_MOVEMENT_ACCOUNTS",
      "No encontre una de las cuentas de la transferencia."
    );
  }

  // `ERR-CUENTAS-06`: el mismo id de origen y destino no es una transferencia.
  if (fromAccount.id === toAccount.id) {
    throw new CoreError(
      "INVALID_MOVEMENT_ACCOUNTS",
      "El origen y el destino son la misma cuenta."
    );
  }

  if (normalizeCurrency(fromAccount.currency) !== normalizeCurrency(toAccount.currency)) {
    throw new CoreError(
      "INVALID_MOVEMENT_ACCOUNTS",
      "La transferencia entre monedas distintas queda fuera de V1."
    );
  }

  return movementInputBase({
    type: "transferencia",
    amount: params.action.amount,
    currency: normalizeCurrency(fromAccount.currency),
    description:
      params.action.description?.trim() ||
      `Transferencia de ${fromAccount.name} a ${toAccount.name}`,
    account_origin_id: fromAccount.id,
    account_destination_id: toAccount.id,
    now: params.now,
    source_ref: params.sourceRef,
    movement_source: params.movementSource,
    metadata: {
      ...params.metadata,
      from_account_id: fromAccount.id,
      to_account_id: toAccount.id,
    },
  });
}

export async function buildBoxMovement(params: {
  action: MoveBoxMoneyInput;
  now: string;
  sourceRef: string;
  metadata: Record<string, unknown>;
  movementSource: Movement["source"];
  read: BoxMovementReads;
}): Promise<MovementInput> {
  const originBox = params.action.box_origin_id
    ? await params.read.getBox(params.action.box_origin_id)
    : null;
  const destinationBox = params.action.box_destination_id
    ? await params.read.getBox(params.action.box_destination_id)
    : null;

  if (
    (params.action.mode === "release_from_box" || params.action.mode === "box_to_box") &&
    !originBox
  ) {
    throw new CoreError("INVALID_MOVEMENT_BOXES", "No encontre la caja origen.");
  }

  if (
    (params.action.mode === "separate_to_box" || params.action.mode === "box_to_box") &&
    !destinationBox
  ) {
    throw new CoreError("INVALID_MOVEMENT_BOXES", "No encontre la caja destino.");
  }

  if (
    originBox &&
    destinationBox &&
    originBox.account_id !== destinationBox.account_id
  ) {
    // `ERR-CUENTAS-07`: mover entre cajas de cuentas distintas no falla en
    // silencio, sugiere transferir primero.
    throw new CoreError(
      "INVALID_MOVEMENT_BOXES",
      "Por ahora solo puedo mover entre cajas de la misma cuenta. Transfiere primero entre las cuentas."
    );
  }

  if (originBox && params.action.amount > Number(originBox.current_balance)) {
    throw new CoreError(
      "INVALID_MOVEMENT_BOXES",
      `La caja ${originBox.name} tiene S/${Number(originBox.current_balance).toFixed(2)}. No puedo mover más.`
    );
  }

  const accountId = destinationBox?.account_id ?? originBox?.account_id;
  const account = accountId ? await params.read.getAccount(accountId) : null;
  if (!account) {
    throw new CoreError(
      "INVALID_MOVEMENT_ACCOUNTS",
      "No encontre la cuenta vinculada a la caja."
    );
  }

  // `ERR-CUENTAS-03`/`04`: separar dinero no puede dejar el libre de la cuenta
  // en negativo. `box_to_box` no lo necesita: redistribuye saldo ya separado,
  // no crea separacion nueva.
  if (params.action.mode === "separate_to_box") {
    const freeBalance = roundMoney(await params.read.getFreeBalance(account.id));
    if (params.action.amount > freeBalance) {
      throw new CoreError(
        "INVALID_MOVEMENT_BOXES",
        `Solo tienes S/${freeBalance.toFixed(2)} libres en ${account.name}.`
      );
    }
  }

  return movementInputBase({
    type: "asignacion_interna",
    amount: params.action.amount,
    currency: normalizeCurrency(account.currency),
    description:
      params.action.description?.trim() ||
      buildBoxDescription(params.action.mode, originBox, destinationBox),
    box_origin_id: originBox?.id ?? null,
    box_destination_id: destinationBox?.id ?? null,
    now: params.now,
    source_ref: params.sourceRef,
    movement_source: params.movementSource,
    metadata: {
      reason: boxModeReason(params.action.mode),
      account_id: account.id,
      box_origin_id: originBox?.id ?? null,
      box_destination_id: destinationBox?.id ?? null,
      // El llamador puede sobreescribir `reason` con su propio vocabulario
      // (por ejemplo, la ruta HTTP antepone `dashboard_`): el default de aqui
      // es solo eso, un default.
      ...params.metadata,
    },
  });
}

export function buildBoxDescription(
  mode: MoveBoxMoneyInput["mode"],
  originBox: Box | null,
  destinationBox: Box | null
): string {
  if (mode === "separate_to_box") {
    return `Separado en caja ${destinationBox?.name ?? ""}`.trim();
  }

  if (mode === "release_from_box") {
    return `Liberado desde caja ${originBox?.name ?? ""}`.trim();
  }

  return `Movimiento de ${originBox?.name ?? "caja"} a ${
    destinationBox?.name ?? "caja"
  }`;
}

export function boxModeReason(mode: MoveBoxMoneyInput["mode"]): string {
  if (mode === "separate_to_box") return "box_separate_money";
  if (mode === "release_from_box") return "box_release_money";
  return "box_transfer_money";
}

export function normalizeCurrency(currency: string): Currency {
  return currency === "USD" ? "USD" : "PEN";
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function movementInputBase(params: {
  type: Movement["type"];
  amount: number;
  currency: Currency;
  description: string;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
  box_origin_id?: string | null;
  box_destination_id?: string | null;
  now: string;
  source_ref: string;
  movement_source: Movement["source"];
  metadata: Record<string, unknown>;
}): MovementInput {
  return {
    type: params.type,
    amount: roundMoney(params.amount),
    currency: params.currency,
    occurred_at: params.now,
    description: params.description,
    merchant: null,
    category_id: null,
    subcategory_id: null,
    account_origin_id: params.account_origin_id ?? null,
    account_destination_id: params.account_destination_id ?? null,
    box_origin_id: params.box_origin_id ?? null,
    box_destination_id: params.box_destination_id ?? null,
    related_person_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    source: params.movement_source,
    source_ref: params.source_ref,
    confidence: 1,
    requires_review: false,
    metadata: params.metadata,
  };
}
