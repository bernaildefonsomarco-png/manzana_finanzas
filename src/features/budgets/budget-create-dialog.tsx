"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import type { BudgetPeriodKind } from "@/core/budgets";
import type { CategoryId } from "@/shared/types/domain";
import { Button } from "@/ui/primitivas/button";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitivas/dialog-parts";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { createBudget } from "./budgets-api";
import { CATEGORY_OPTIONS, periodLabel } from "./budget-options";
import type { BudgetCreatePayload } from "./budgets-types";

export function BudgetCreateDialog({
  open,
  periodKind,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  periodKind: BudgetPeriodKind;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | "general">(
    "alimentacion"
  );
  const [kind, setKind] =
    useState<BudgetCreatePayload["kind"]>("presupuesto");
  const [rollover, setRollover] = useState(false);
  const mutation = useMutation({
    mutationFn: createBudget,
    onSuccess: onCreated,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!Number.isFinite(parsed) || parsed <= 0) return;
    mutation.mutate({
      amount: parsed,
      category_id: categoryId === "general" ? null : categoryId,
      period_kind: periodKind,
      kind,
      rollover,
      auto_renew: true,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo presupuesto</DialogTitle>
          <DialogDescription>
            Es una referencia para el periodo {periodLabel(periodKind)}. No
            aparta saldo ni bloquea un gasto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FieldShell label="Categoría" htmlFor="budget-category" required>
            <Select
              id="budget-category"
              value={categoryId}
              onChange={(event) =>
                setCategoryId(event.target.value as CategoryId | "general")
              }
            >
              <option value="general">General</option>
              {CATEGORY_OPTIONS.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </FieldShell>
          <FieldShell
            label={`Monto ${periodLabel(periodKind)}`}
            htmlFor="budget-amount"
            required
          >
            <Input
              id="budget-amount"
              inputMode="decimal"
              prefix="S/"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FieldShell>
          <FieldShell label="Tipo" htmlFor="budget-kind" required>
            <Select
              id="budget-kind"
              value={kind}
              onChange={(event) =>
                setKind(event.target.value as BudgetCreatePayload["kind"])
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
            <span>
              Pasar al periodo siguiente la parte no usada de la base. El
              acarreo anterior vence al terminar ese siguiente periodo.
            </span>
          </label>
          {mutation.isError ? (
            <p role="alert" className="text-sm text-error">
              No pude crear el presupuesto. Revisa los datos o intenta de nuevo.
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
            <Button type="submit" loading={mutation.isPending}>
              Crear presupuesto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
