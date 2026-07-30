"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/ui/primitivas/button";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitivas/dialog-parts";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import type {
  BudgetDetailView,
  BudgetUpdatePayload,
} from "./budgets-types";

export function BudgetEditDialog({
  budget,
  open,
  pending,
  failed,
  onOpenChange,
  onSubmit,
}: {
  budget: BudgetDetailView;
  open: boolean;
  pending: boolean;
  failed: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: BudgetUpdatePayload) => void;
}) {
  const [amount, setAmount] = useState(String(budget.base_amount));
  const [kind, setKind] = useState<BudgetDetailView["kind"]>(budget.kind);
  const [rollover, setRollover] = useState(budget.rollover);
  const [autoRenew, setAutoRenew] = useState(budget.auto_renew);
  const [amountError, setAmountError] = useState<string | undefined>();

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (
      !Number.isFinite(parsed) ||
      parsed <= 0 ||
      !Number.isInteger(parsed * 100)
    ) {
      setAmountError("Ingresa un monto positivo con máximo dos decimales.");
      return;
    }
    setAmountError(undefined);
    onSubmit({
      amount: parsed,
      kind,
      rollover,
      auto_renew: autoRenew,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar presupuesto</DialogTitle>
          <DialogDescription>
            Cambia la base y las reglas de este presupuesto. El acarreo ya
            recibido se mantiene separado de la base.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FieldShell
            label="Monto base del periodo"
            htmlFor="budget-edit-amount"
            hint="El total mostrado puede incluir un acarreo del periodo anterior."
            error={amountError}
            required
          >
            <Input
              id="budget-edit-amount"
              inputMode="decimal"
              prefix="S/"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FieldShell>
          <FieldShell label="Tipo" htmlFor="budget-edit-kind" required>
            <Select
              id="budget-edit-kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as BudgetDetailView["kind"])
              }
            >
              <option value="presupuesto">Presupuesto</option>
              <option value="limite_blando">Límite orientativo</option>
              <option value="limite_duro">Límite estricto informativo</option>
            </Select>
          </FieldShell>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={rollover}
              onChange={(event) => setRollover(event.target.checked)}
              className="mt-1"
            />
            <span>Pasar al periodo siguiente la parte no usada de la base.</span>
          </label>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input
              type="checkbox"
              checked={autoRenew}
              onChange={(event) => setAutoRenew(event.target.checked)}
              className="mt-1"
            />
            <span>Renovar este presupuesto al comenzar el siguiente periodo.</span>
          </label>
          {failed ? (
            <p role="alert" className="text-sm text-error">
              No pude guardar el ajuste. Revisa los datos o intenta de nuevo.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" loading={pending}>
              Guardar ajuste
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
