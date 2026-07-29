"use client";

import { useState } from "react";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { MoveModeSelect, MoveMoneyFields } from "./move-money-fields";
import { DialogMutationError } from "@/shared/ui/dialog-mutation-error";
import { executeMoneyAction, type MoneyActionPayload } from "@/shared/api/money";
import type { AccountMoneySummary, BoxMoneySummary } from "@/shared/api/money-types";
import {
  MOVE_MODE_EXPLANATION,
  MOVE_MODE_LABELS,
  buildMovePayload,
  initialDestinationBoxId,
  initialFromAccountId,
  initialOriginBoxId,
  initialToAccountId,
  moveSuccessMessage,
  type MoveMoneyIntent,
  type MoveMoneyMode,
} from "./move-money-logic";

export type { MoveMoneyIntent };

/** SCR-CUENTAS-06: una sola superficie para transferir, separar, devolver y mover entre cajas. */
export function MoveMoneyDialog({
  open,
  onOpenChange,
  intent,
  accounts,
  boxes,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  intent: MoveMoneyIntent;
  accounts: AccountMoneySummary[];
  boxes: BoxMoneySummary[];
  onDone: (message: string) => void;
}) {
  // Solo se monta cuando esta abierto (el padre lo renderiza
  // condicionalmente): un montaje nuevo ya es "abrir de nuevo".
  const [mode, setMode] = useState<MoveMoneyMode>(intent.kind);
  const [amountRaw, setAmountRaw] = useState("");
  const [description, setDescription] = useState("");
  const [fromAccountId, setFromAccountId] = useState(() => initialFromAccountId(intent, accounts));
  const [toAccountId, setToAccountId] = useState(() => initialToAccountId(intent, accounts));
  const [originBoxId, setOriginBoxId] = useState(() => initialOriginBoxId(intent, boxes));
  const [destinationBoxId, setDestinationBoxId] = useState(() => initialDestinationBoxId(intent, boxes));
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useOptimisticMutation<MoneyActionPayload, { movement: unknown }>({
    mutation: "movement.create",
    mutationFn: (payload) => executeMoneyAction(payload),
  });

  async function handleSubmit() {
    setValidationError(null);
    const result = buildMovePayload({
      mode,
      amountRaw,
      description,
      fromAccountId,
      toAccountId,
      originBoxId,
      destinationBoxId,
    });
    if (!result.ok) {
      setValidationError(result.error);
      return;
    }
    try {
      await mutation.mutateAsync(result.payload);
      onOpenChange(false);
      onDone(moveSuccessMessage(result.payload));
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }

  if (intent.kind === "transfer" && accounts.length === 0) return null;
  if (intent.kind !== "transfer" && boxes.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Mover dinero</DialogTitle>
          <DialogDescription>{MOVE_MODE_EXPLANATION[mode]}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <MoveModeSelect
            mode={mode}
            hasEnoughAccounts={accounts.length >= 2}
            hasBoxes={boxes.length > 0}
            onChange={setMode}
          />

          <MoveMoneyFields
            mode={mode}
            accounts={accounts}
            boxes={boxes}
            fromAccountId={fromAccountId}
            toAccountId={toAccountId}
            originBoxId={originBoxId}
            destinationBoxId={destinationBoxId}
            onFromAccountChange={setFromAccountId}
            onToAccountChange={setToAccountId}
            onOriginBoxChange={setOriginBoxId}
            onDestinationBoxChange={setDestinationBoxId}
          />

          <FieldShell label="Monto" htmlFor="move-amount">
            <Input
              id="move-amount"
              inputMode="decimal"
              prefix="S/"
              value={amountRaw}
              onChange={(e) => setAmountRaw(e.target.value)}
            />
          </FieldShell>
          <FieldShell label="Descripcion" htmlFor="move-description" hint="Opcional">
            <Input id="move-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </FieldShell>

          {validationError ? (
            <p role="alert" className="text-sm text-error">
              {validationError}
            </p>
          ) : null}
          <DialogMutationError error={mutation.error} />
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={mutation.isPending}>
            {MOVE_MODE_LABELS[mode]}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
