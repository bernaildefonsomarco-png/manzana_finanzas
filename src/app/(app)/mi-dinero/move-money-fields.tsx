"use client";

import { FieldShell, Select } from "@/ui/primitivas/field";
import type { AccountMoneySummary, BoxMoneySummary } from "@/shared/api/money-types";
import { MOVE_MODE_LABELS, type MoveMoneyMode } from "./move-money-logic";

/** Selector de modo: solo ofrece transferir si hay 2+ cuentas, cajas si hay alguna. */
export function MoveModeSelect({
  mode,
  hasEnoughAccounts,
  hasBoxes,
  onChange,
}: {
  mode: MoveMoneyMode;
  hasEnoughAccounts: boolean;
  hasBoxes: boolean;
  onChange: (mode: MoveMoneyMode) => void;
}) {
  return (
    <FieldShell label="Tipo de movimiento" htmlFor="move-mode">
      <Select id="move-mode" value={mode} onChange={(event) => onChange(event.target.value as MoveMoneyMode)}>
        {hasEnoughAccounts ? <option value="transfer">{MOVE_MODE_LABELS.transfer}</option> : null}
        {hasBoxes ? (
          <>
            <option value="separate_to_box">{MOVE_MODE_LABELS.separate_to_box}</option>
            <option value="release_from_box">{MOVE_MODE_LABELS.release_from_box}</option>
            <option value="box_to_box">{MOVE_MODE_LABELS.box_to_box}</option>
          </>
        ) : null}
      </Select>
    </FieldShell>
  );
}

/** Campos de cuentas (transferir) o cajas (separar/liberar/mover), segun el modo. */
export function MoveMoneyFields({
  mode,
  accounts,
  boxes,
  fromAccountId,
  toAccountId,
  originBoxId,
  destinationBoxId,
  onFromAccountChange,
  onToAccountChange,
  onOriginBoxChange,
  onDestinationBoxChange,
}: {
  mode: MoveMoneyMode;
  accounts: AccountMoneySummary[];
  boxes: BoxMoneySummary[];
  fromAccountId: string;
  toAccountId: string;
  originBoxId: string;
  destinationBoxId: string;
  onFromAccountChange: (value: string) => void;
  onToAccountChange: (value: string) => void;
  onOriginBoxChange: (value: string) => void;
  onDestinationBoxChange: (value: string) => void;
}) {
  if (mode === "transfer") {
    return (
      <>
        <FieldShell label="Desde" htmlFor="move-from">
          <Select id="move-from" value={fromAccountId} onChange={(e) => onFromAccountChange(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {`${a.name} - S/${a.current_balance.toFixed(2)}`}
              </option>
            ))}
          </Select>
        </FieldShell>
        <FieldShell label="Hacia" htmlFor="move-to">
          <Select id="move-to" value={toAccountId} onChange={(e) => onToAccountChange(e.target.value)}>
            <option value="">Elige destino</option>
            {accounts
              .filter((a) => a.id !== fromAccountId)
              .map((a) => (
                <option key={a.id} value={a.id}>
                  {`${a.name} - S/${a.current_balance.toFixed(2)}`}
                </option>
              ))}
          </Select>
        </FieldShell>
      </>
    );
  }

  return (
    <>
      {mode !== "separate_to_box" ? (
        <FieldShell label="Caja origen" htmlFor="move-origin-box">
          <Select id="move-origin-box" value={originBoxId} onChange={(e) => onOriginBoxChange(e.target.value)}>
            {boxes.map((b) => (
              <option key={b.id} value={b.id}>
                {`${b.name} - S/${b.current_balance.toFixed(2)}`}
              </option>
            ))}
          </Select>
        </FieldShell>
      ) : null}
      {mode !== "release_from_box" ? (
        <FieldShell label="Caja destino" htmlFor="move-destination-box">
          <Select
            id="move-destination-box"
            value={destinationBoxId}
            onChange={(e) => onDestinationBoxChange(e.target.value)}
          >
            <option value="">Elige destino</option>
            {boxes
              .filter((b) => mode !== "box_to_box" || b.id !== originBoxId)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {`${b.name} - S/${b.current_balance.toFixed(2)}`}
                </option>
              ))}
          </Select>
        </FieldShell>
      ) : null}
    </>
  );
}
