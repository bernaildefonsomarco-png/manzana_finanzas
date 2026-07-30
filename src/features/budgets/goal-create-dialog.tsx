"use client";

import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/ui/primitivas/button";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitivas/dialog-parts";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { createGoal } from "./budgets-api";
import type { GoalCreatePayload } from "./budgets-types";

export function GoalCreateDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const mutation = useMutation({
    mutationFn: (payload: GoalCreatePayload) => createGoal(payload),
    onSuccess: onCreated,
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = Number(amount.replace(",", "."));
    if (!name.trim() || !Number.isFinite(parsed) || parsed <= 0) return;
    mutation.mutate({
      name: name.trim(),
      target_amount: parsed,
      target_date: targetDate || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva meta</DialogTitle>
          <DialogDescription>
            Sin caja es una intención. Al vincular una caja, su saldo real
            mostrará el avance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <FieldShell label="Nombre" htmlFor="goal-name" required>
            <Input
              id="goal-name"
              value={name}
              maxLength={60}
              onChange={(event) => setName(event.target.value)}
            />
          </FieldShell>
          <FieldShell label="Objetivo" htmlFor="goal-amount" required>
            <Input
              id="goal-amount"
              inputMode="decimal"
              prefix="S/"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </FieldShell>
          <FieldShell
            label="Fecha objetivo"
            htmlFor="goal-date"
            hint="Opcional. El ritmo mensual se muestra como dato."
          >
            <Input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
            />
          </FieldShell>
          {mutation.isError ? (
            <p role="alert" className="text-sm text-error">
              No pude crear la meta. Revisa los datos o intenta de nuevo.
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
              Crear meta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
