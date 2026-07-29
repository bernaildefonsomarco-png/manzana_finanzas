import type { MoneyActionPayload } from "@/shared/api/money";
import type { AccountMoneySummary, BoxMoneySummary } from "@/shared/api/money-types";

export type MoveMoneyIntent =
  | { kind: "transfer"; fromAccountId?: string }
  | { kind: "separate_to_box"; boxId?: string }
  | { kind: "release_from_box"; boxId?: string }
  | { kind: "box_to_box"; boxId?: string };

export type MoveMoneyMode = "transfer" | "separate_to_box" | "release_from_box" | "box_to_box";

export const MOVE_MODE_LABELS: Record<MoveMoneyMode, string> = {
  transfer: "Transferir entre cuentas",
  separate_to_box: "Separar en una caja",
  release_from_box: "Liberar de una caja",
  box_to_box: "Mover entre cajas",
};

export const MOVE_MODE_EXPLANATION: Record<MoveMoneyMode, string> = {
  transfer: "Una transferencia baja el saldo de una cuenta y sube el de otra. No cambia tu saldo total.",
  separate_to_box:
    "Separar dinero aumenta una caja y reduce tu dinero libre, sin cambiar el saldo de cuenta.",
  release_from_box:
    "Liberar dinero baja la caja y aumenta tu dinero libre, sin cambiar el saldo de cuenta.",
  box_to_box: "Mover entre cajas conserva el total separado y solo cambia su distribucion.",
};

export function initialFromAccountId(intent: MoveMoneyIntent, accounts: AccountMoneySummary[]): string {
  return intent.kind === "transfer" ? intent.fromAccountId ?? accounts[0]?.id ?? "" : "";
}

export function initialToAccountId(intent: MoveMoneyIntent, accounts: AccountMoneySummary[]): string {
  if (intent.kind !== "transfer") return "";
  const from = intent.fromAccountId ?? accounts[0]?.id ?? "";
  return accounts.find((a) => a.id !== from)?.id ?? "";
}

export function initialOriginBoxId(intent: MoveMoneyIntent, boxes: BoxMoneySummary[]): string {
  if (intent.kind === "transfer" || intent.kind === "separate_to_box") return "";
  return intent.boxId ?? boxes[0]?.id ?? "";
}

/** Preferencia: otra caja de la misma cuenta primero (24 §9). */
export function initialDestinationBoxId(intent: MoveMoneyIntent, boxes: BoxMoneySummary[]): string {
  if (intent.kind === "transfer" || intent.kind === "release_from_box") return "";
  if (intent.kind === "separate_to_box") return intent.boxId ?? boxes[0]?.id ?? "";
  const originId = intent.boxId ?? boxes[0]?.id ?? "";
  const originBox = intent.boxId ? boxes.find((b) => b.id === intent.boxId) : null;
  const sameAccount = boxes.find((b) => b.id !== originId && b.account_id === originBox?.account_id);
  return sameAccount?.id ?? boxes.find((b) => b.id !== originId)?.id ?? "";
}

export function parseMoveAmount(raw: string): number | null {
  const trimmed = raw.trim().replace(",", ".");
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round(parsed * 100) / 100;
}

export type BuildMovePayloadResult =
  | { ok: true; payload: MoneyActionPayload }
  | { ok: false; error: string };

export function buildMovePayload(params: {
  mode: MoveMoneyMode;
  amountRaw: string;
  description: string;
  fromAccountId: string;
  toAccountId: string;
  originBoxId: string;
  destinationBoxId: string;
}): BuildMovePayloadResult {
  const amount = parseMoveAmount(params.amountRaw);
  if (amount == null) {
    return { ok: false, error: "El monto debe ser mayor a cero." };
  }
  const description = params.description.trim() || undefined;

  if (params.mode === "transfer") {
    if (!params.fromAccountId || !params.toAccountId) {
      return { ok: false, error: "Elige cuenta origen y destino." };
    }
    if (params.fromAccountId === params.toAccountId) {
      return { ok: false, error: "La cuenta destino debe ser distinta." };
    }
    return {
      ok: true,
      payload: {
        action: "transfer_between_accounts",
        from_account_id: params.fromAccountId,
        to_account_id: params.toAccountId,
        amount,
        description,
      },
    };
  }

  if (params.mode === "separate_to_box" && !params.destinationBoxId) {
    return { ok: false, error: "Elige la caja donde vas a separar dinero." };
  }
  if (params.mode === "release_from_box" && !params.originBoxId) {
    return { ok: false, error: "Elige la caja de origen." };
  }
  if (params.mode === "box_to_box") {
    if (!params.originBoxId || !params.destinationBoxId) {
      return { ok: false, error: "Elige caja origen y destino." };
    }
    if (params.originBoxId === params.destinationBoxId) {
      return { ok: false, error: "La caja destino debe ser distinta." };
    }
  }

  return {
    ok: true,
    payload: {
      action: "move_box_money",
      mode: params.mode,
      amount,
      box_origin_id: params.mode === "separate_to_box" ? null : params.originBoxId,
      box_destination_id: params.mode === "release_from_box" ? null : params.destinationBoxId,
      description,
    },
  };
}

export function moveSuccessMessage(payload: MoneyActionPayload): string {
  if (payload.action === "transfer_between_accounts") {
    return "Transferencia registrada. El saldo total no cambio.";
  }
  if (payload.action === "move_box_money") {
    if (payload.mode === "separate_to_box") return "Dinero separado en caja. Tu dinero libre se actualizo.";
    if (payload.mode === "release_from_box") return "Dinero liberado de la caja. Tu dinero libre se actualizo.";
    return "Movimiento entre cajas registrado.";
  }
  return "Movimiento registrado.";
}
