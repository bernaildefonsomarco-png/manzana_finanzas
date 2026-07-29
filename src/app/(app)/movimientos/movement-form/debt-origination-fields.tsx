"use client";

import { FieldShell, Input } from "@/ui/primitivas/field";
import type { MovementFormState } from "./use-movement-form";
import { AccountSelect } from "./account-box-select";

/** Campos de `deuda_adquirida`, `prestamo_dado`, `prestamo_recibido`
 * (`26` §4.3, `WEB-D198`). */
export function DebtOriginationFields({ form }: { form: MovementFormState }) {
  const { type } = form;
  return (
    <>
      <FieldShell label={type === "deuda_adquirida" ? "Persona o entidad" : "Persona"} htmlFor="movement-related-person" required>
        <Input
          id="movement-related-person"
          value={form.relatedPersonName}
          onChange={(e) => form.setRelatedPersonName(e.target.value)}
          placeholder={type === "deuda_adquirida" ? "Tienda X, Banco Y…" : "Nombre"}
        />
      </FieldShell>
      {type !== "deuda_adquirida" ? (
        <AccountSelect
          label={type === "prestamo_dado" ? "Cuenta origen" : "Cuenta destino"}
          value={type === "prestamo_dado" ? form.accountOriginId : form.accountDestinationId}
          onChange={type === "prestamo_dado" ? form.setAccountOriginId : form.setAccountDestinationId}
          accounts={form.accounts}
          allowEmpty
        />
      ) : null}
    </>
  );
}
