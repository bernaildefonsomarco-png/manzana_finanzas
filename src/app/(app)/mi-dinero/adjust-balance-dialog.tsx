"use client";
import { useState } from "react";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/ui/primitivas/dialog-parts";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { MoneyText } from "@/ui/primitivas/money";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
import { executeMoneyAction, type MoneyActionPayload } from "@/shared/api/money";
import { ApiClientError } from "@/shared/api/http-client";
import type { AccountMoneySummary } from "@/shared/api/money-types";
/**
 * SCR-CUENTAS-07 (RUL-CUENTAS-08): el saldo no se edita, se ajusta — esto
 * crea un movimiento `ajuste` auditado por la diferencia, nunca un
 * `UPDATE` directo.
 */
export function AdjustBalanceDialog({
  account,
  open,
  onOpenChange,
  onDone,
}: {
  account: AccountMoneySummary | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (message: string) => void;
}) {
  const [targetRaw, setTargetRaw] = useState("");
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  // Reajusta los campos al abrir, calculado durante el render (no en un
  // efecto, para no encadenar renders — react.dev "You Might Not Need an
  // Effect"): compara contra el `open` del render anterior.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && account) {
      setTargetRaw(account.current_balance.toFixed(2));
      setReason("");
      setValidationError(null);
    }
  }
  const mutation = useOptimisticMutation<MoneyActionPayload, { movement: unknown }>({
    mutation: "movement.create",
    mutationFn: (payload) => executeMoneyAction(payload),
  });
  if (!account) return null;
  const parsedTarget = (() => {
    const raw = targetRaw.trim().replace(",", ".");
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.round(value * 100) / 100 : null;
  })();
  const delta = parsedTarget != null ? Math.round((parsedTarget - account.current_balance) * 100) / 100 : null;
  async function handleSubmit() {
    setValidationError(null);
    if (parsedTarget == null) {
      setValidationError("El saldo correcto debe ser un numero valido.");
      return;
    }
    if (Math.abs(parsedTarget - (account?.current_balance ?? 0)) < 0.01) {
      setValidationError("Ese ya es el saldo registrado.");
      return;
    }
    try {
      await mutation.mutateAsync({
        action: "adjust_account_balance",
        account_id: account!.id,
        target_balance: parsedTarget,
        reason: reason.trim() || undefined,
      });
      onOpenChange(false);
      onDone("Saldo ajustado con auditoria.");
    } catch {
      // El error se muestra via mutation.error mas abajo.
    }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajustar saldo de {account.name}</DialogTitle>
          <DialogDescription>
            El saldo no se edita directo: Manzana guarda un movimiento de ajuste por la diferencia.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-baseline justify-between rounded-lg border border-border bg-bg-surface px-3 py-2 text-sm">
            <span className="text-text-secondary">Saldo actual</span>
            <MoneyText
              value={account.current_balance}
              currency={account.currency === "USD" ? "USD" : "PEN"}
            />
          </div>
          <FieldShell label="Saldo correcto" htmlFor="adjust-target" hint="Manzana crea un ajuste por la diferencia.">
            <Input
              id="adjust-target"
              inputMode="decimal"
              prefix="S/"
              value={targetRaw}
              onChange={(e) => setTargetRaw(e.target.value)}
            />
          </FieldShell>
          {delta != null && Math.abs(delta) >= 0.01 ? (
            <p className="text-sm text-text-secondary">
              Diferencia:{" "}
              <MoneyText
                value={delta}
                currency={account.currency === "USD" ? "USD" : "PEN"}
                sign="auto"
              />
            </p>
          ) : null}
          <FieldShell label="Motivo" htmlFor="adjust-reason" hint="Opcional. Visible en auditoria interna.">
            <Input
              id="adjust-reason"
              placeholder="Correccion manual de saldo"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </FieldShell>
          {validationError ? (
            <p role="alert" className="text-sm text-error">
              {validationError}
            </p>
          ) : null}
          {mutation.error ? (
            <p role="alert" className="text-sm text-error">
              {mutation.error instanceof ApiClientError
                ? mutation.error.message
                : "No pude completar la accion. Intenta otra vez en un momento."}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit} loading={mutation.isPending}>
            Ajustar saldo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
