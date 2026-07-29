"use client";

import { FieldShell, Select } from "@/ui/primitivas/field";
import type { MovementFormState } from "./use-movement-form";
import { AccountSelect } from "./account-box-select";

/** Campos de `pago_deuda`, `devolucion_recibida` (`26` §4.3, `WEB-D195`). */
export function DebtPaymentFields({ form }: { form: MovementFormState }) {
  const { type } = form;
  return (
    <>
      <FieldShell label="Deuda" htmlFor="movement-debt" required>
        <Select id="movement-debt" value={form.debtId} onChange={(e) => form.setDebtId(e.target.value)}>
          <option value="">Elige una deuda</option>
          {form.relevantDebts.map((debt) => (
            <option key={debt.id} value={debt.id}>
              {debt.name} — S/{debt.current_balance.toFixed(2)}
            </option>
          ))}
        </Select>
      </FieldShell>
      {form.relevantDebts.length === 0 ? (
        <p className="text-xs text-text-muted">
          No tienes deudas de este tipo todavía. Puedes crear una con &ldquo;Deuda adquirida&rdquo; o &ldquo;Préstamo
          dado/recibido&rdquo;.
        </p>
      ) : null}
      <AccountSelect
        label={type === "pago_deuda" ? "Cuenta origen" : "Cuenta destino"}
        value={type === "pago_deuda" ? form.accountOriginId : form.accountDestinationId}
        onChange={type === "pago_deuda" ? form.setAccountOriginId : form.setAccountDestinationId}
        accounts={form.accounts}
        allowEmpty
      />
    </>
  );
}
