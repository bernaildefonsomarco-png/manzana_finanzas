"use client";

import { useState } from "react";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { parseMoneyInput } from "@/shared/money/parse-money-input";
import { ApiClientError, updateMovement } from "@/shared/api/movements";
import type { Movement } from "@/shared/types/domain";

/** `ACT-MOV-02`/`RUL-MOV-05`: edita los campos seguros de cualquier tipo
 * (no incluye cambiar el tipo, `RUL-MOV-07`, diferido — `WEB-D195`). */
export function EditMovementFields({
  movement,
  onCancel,
  onSaved,
}: {
  movement: Movement;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [amountRaw, setAmountRaw] = useState(String(movement.amount));
  const [description, setDescription] = useState(movement.description ?? "");
  const [merchant, setMerchant] = useState(movement.merchant ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError(null);
    const amount = parseMoneyInput(amountRaw);
    if (amount === null) {
      setError("No entendí ese monto. Escríbelo como 40 o 40.50.");
      return;
    }
    setSaving(true);
    try {
      await updateMovement(
        movement.id,
        { amount, description: description.trim() || null, merchant: merchant.trim() || null },
        "user_edit_from_detail",
      );
      onSaved();
    } catch (thrown) {
      setError(thrown instanceof ApiClientError ? thrown.message : "No pude guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-lg border border-border bg-bg-surface p-4">
      <FieldShell label="Monto" htmlFor="edit-amount">
        <Input id="edit-amount" value={amountRaw} onChange={(e) => setAmountRaw(e.target.value)} inputMode="decimal" />
      </FieldShell>
      <FieldShell label="Comercio" htmlFor="edit-merchant">
        <Input id="edit-merchant" value={merchant} onChange={(e) => setMerchant(e.target.value)} />
      </FieldShell>
      <FieldShell label="Descripción" htmlFor="edit-description">
        <Input id="edit-description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </FieldShell>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button size="sm" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </div>
  );
}
