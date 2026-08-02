"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import { FieldShell, Input } from "@/ui/primitivas/field";
import { RadioGroup, RadioGroupItem } from "@/ui/primitivas/radio-group";
import { useMovementForm } from "./use-movement-form";
import { MovementTypeFields } from "./movement-type-fields";
import { MOVEMENT_TYPE_LABEL, MOVEMENT_TYPE_ORDER, MOVEMENT_TYPE_SPECIALIZED_LINK } from "./movement-types";
import type { MovementType } from "@/shared/types/domain";
import type { MovementPrefill } from "@/shared/movements/movement-prefill";

type Props = {
  onSaved: () => void;
  onCancel: () => void;
  prefill?: MovementPrefill;
  prefillError?: string;
};

/**
 * `SCR-MOV-03`: selector de tipo primero, formulario adaptado segun `26`
 * §4.3. Los 11 tipos terminan en un boton de guardar funcional (`AC-MOV-01`).
 * El estado y el envio viven en `useMovementForm`; los campos por tipo, en
 * `MovementTypeFields` — este fichero solo compone ambos.
 */
export function MovementForm({ onSaved, onCancel, prefill, prefillError }: Props) {
  const form = useMovementForm(onSaved, prefill);
  const specializedLink = MOVEMENT_TYPE_SPECIALIZED_LINK[form.type];

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit(false);
      }}
    >
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-text-secondary">Tipo de movimiento</legend>
        <RadioGroup value={form.type} name="movement-type" onValueChange={(value) => form.changeType(value as MovementType)}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
            {MOVEMENT_TYPE_ORDER.map((value) => (
              <RadioGroupItem key={value} value={value}>
                {MOVEMENT_TYPE_LABEL[value]}
              </RadioGroupItem>
            ))}
          </div>
        </RadioGroup>
      </fieldset>

      {prefillError ? (
        <p role="alert" className="rounded-lg border border-warning-subtle bg-warning-subtle/30 p-3 text-sm text-text">
          {prefillError} Puedes completar el movimiento manualmente.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <FieldShell label="Monto" htmlFor="movement-amount" required>
          <Input
            id="movement-amount"
            inputMode="decimal"
            placeholder="40.00"
            value={form.amountRaw}
            onChange={(event) => form.setAmountRaw(event.target.value)}
            prefix="S/"
          />
        </FieldShell>
        <FieldShell label="Fecha" htmlFor="movement-occurred-date" required>
          <Input
            id="movement-occurred-date"
            type="date"
            value={form.occurredDate}
            onChange={(event) => form.changeOccurredDate(event.target.value)}
          />
        </FieldShell>
        <FieldShell label="Hora" htmlFor="movement-occurred-time" required>
          <Input
            id="movement-occurred-time"
            type="time"
            value={form.occurredTime}
            onChange={(event) => form.setOccurredTime(event.target.value)}
          />
        </FieldShell>
      </div>

      {form.occurredDateIsFuture ? (
        <p role="alert" className="text-sm text-warning">
          Esa fecha todavía no llega. Cámbiala para registrar el movimiento o anótalo en Pagos que vienen.
        </p>
      ) : null}

      <MovementTypeFields form={form} />

      {form.type !== "ajuste" ? (
        <FieldShell label="Descripción" htmlFor="movement-description">
          <Input id="movement-description" value={form.description} onChange={(e) => form.setDescription(e.target.value)} />
        </FieldShell>
      ) : null}

      {specializedLink ? (
        <Link href={specializedLink.href} className="block text-sm font-medium text-brand hover:text-brand-hover">
          {specializedLink.label}
        </Link>
      ) : null}

      {form.duplicateWarning ? (
        <div className="flex items-start gap-3 rounded-lg border border-warning-subtle bg-warning-subtle/30 p-3 text-sm text-text">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
          <div className="space-y-2">
            <p>
              {form.duplicateWarning.dedup_status === "exact_duplicate"
                ? "Este movimiento ya fue registrado."
                : "Encontré un movimiento parecido. ¿Es el mismo?"}
            </p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => form.setDuplicateWarning(null)}>
                Revisar
              </Button>
              <Button type="button" size="sm" onClick={() => void form.handleSubmit(true)}>
                Guardar de todos modos
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {form.error ? <p className="text-sm text-error">{form.error}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" disabled={form.submitting || form.occurredDateIsFuture}>
          {form.submitting ? "Guardando…" : "Guardar movimiento"}
        </Button>
      </div>
    </form>
  );
}
