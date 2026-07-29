"use client";

import { FieldShell, Input } from "@/ui/primitivas/field";

/** Campo de monto con coma o punto decimal, compartido entre los formularios de Mi Dinero. */
export function MoneyAmountField({
  id,
  label,
  hint,
  error,
  defaultValue,
  onValueChange,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  defaultValue?: string;
  onValueChange: (value: number) => void;
}) {
  return (
    <FieldShell label={label} htmlFor={id} hint={hint} error={error}>
      <Input
        id={id}
        inputMode="decimal"
        prefix="S/"
        defaultValue={defaultValue}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(",", "."));
          onValueChange(Number.isFinite(parsed) ? parsed : NaN);
        }}
      />
    </FieldShell>
  );
}
