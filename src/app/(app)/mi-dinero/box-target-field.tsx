"use client";

import { FieldShell, Input } from "@/ui/primitivas/field";
import { DatePicker } from "@/ui/primitivas/date-picker";

/** Campo "Meta" (+ fecha objetivo si hay meta), compartido entre crear/editar caja. */
export function BoxTargetField({
  targetAmount,
  targetDate,
  error,
  defaultValue,
  onTargetAmountChange,
  onTargetDateChange,
}: {
  targetAmount: number | null;
  targetDate: string | null;
  error?: string;
  defaultValue?: number | "";
  onTargetAmountChange: (value: number | null) => void;
  onTargetDateChange: (value: string) => void;
}) {
  return (
    <>
      <FieldShell label="Meta" htmlFor="box-target" hint="Opcional" error={error}>
        <Input
          id="box-target"
          inputMode="decimal"
          prefix="S/"
          defaultValue={defaultValue}
          onChange={(event) => {
            const raw = event.target.value.trim();
            if (!raw) {
              onTargetAmountChange(null);
              return;
            }
            const parsed = Number(raw.replace(",", "."));
            onTargetAmountChange(Number.isFinite(parsed) ? parsed : NaN);
          }}
        />
      </FieldShell>
      {targetAmount != null ? (
        <FieldShell label="Fecha objetivo" htmlFor="box-target-date" hint="Opcional">
          <DatePicker value={targetDate} onValueChange={onTargetDateChange} aria-label="Fecha objetivo de la caja" />
        </FieldShell>
      ) : null}
    </>
  );
}
