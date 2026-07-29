"use client";

import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { CategorySelector } from "@/shared/ui/category-selector/category-selector";
import type { MovementFormState } from "./use-movement-form";
import { AccountSelect, BoxSelect } from "./account-box-select";

/** Campos de los seis tipos genericos (`26` §4.3): gasto, ingreso,
 * transferencia, asignacion_interna, ajuste, pago_recurrente. */
export function GenericMovementFields({ form }: { form: MovementFormState }) {
  const { type } = form;

  if (type === "gasto") {
    return (
      <>
        <FieldShell label="Comercio" htmlFor="movement-merchant">
          <Input id="movement-merchant" value={form.merchant} onChange={(e) => form.setMerchant(e.target.value)} />
        </FieldShell>
        <FieldShell label="Categoría" htmlFor="movement-category">
          <CategorySelector value={form.category} onChange={form.setCategory} aria-label="Categoría" />
        </FieldShell>
        <AccountSelect
          label="Cuenta"
          value={form.accountOriginId}
          onChange={form.setAccountOriginId}
          accounts={form.accounts}
          allowEmpty
        />
        <BoxSelect label="Caja" value={form.boxOriginId} onChange={form.setBoxOriginId} boxes={form.boxes} allowEmpty />
      </>
    );
  }

  if (type === "ingreso") {
    return (
      <>
        <FieldShell label="Categoría" htmlFor="movement-category">
          <CategorySelector value={form.category} onChange={form.setCategory} aria-label="Categoría" />
        </FieldShell>
        <AccountSelect
          label="Cuenta"
          value={form.accountDestinationId}
          onChange={form.setAccountDestinationId}
          accounts={form.accounts}
          allowEmpty
        />
      </>
    );
  }

  if (type === "transferencia") {
    return (
      <>
        <AccountSelect label="Desde" value={form.accountOriginId} onChange={form.setAccountOriginId} accounts={form.accounts} required />
        <AccountSelect
          label="Hacia"
          value={form.accountDestinationId}
          onChange={form.setAccountDestinationId}
          accounts={form.accounts.filter((a) => a.id !== form.accountOriginId)}
          required
        />
      </>
    );
  }

  if (type === "asignacion_interna") {
    return (
      <>
        <BoxSelect label="Caja origen" value={form.boxOriginId} onChange={form.setBoxOriginId} boxes={form.boxes} allowEmpty />
        <BoxSelect
          label="Caja destino"
          value={form.boxDestinationId}
          onChange={form.setBoxDestinationId}
          boxes={form.boxes.filter((b) => b.id !== form.boxOriginId)}
          allowEmpty
        />
      </>
    );
  }

  if (type === "ajuste") {
    return (
      <>
        <AccountSelect label="Cuenta" value={form.accountOriginId} onChange={form.setAccountOriginId} accounts={form.accounts} required />
        <FieldShell label="Motivo" htmlFor="movement-adjustment-reason" required>
          <Input
            id="movement-adjustment-reason"
            placeholder="Conté mal el efectivo"
            value={form.adjustmentReason}
            onChange={(e) => form.setAdjustmentReason(e.target.value)}
          />
        </FieldShell>
        <p className="text-xs text-text-muted">
          Usa un monto negativo (por ejemplo -15) si el saldo real es menor al calculado.
        </p>
      </>
    );
  }

  // pago_recurrente
  return (
    <>
      <FieldShell label="Regla recurrente" htmlFor="movement-recurring-rule" required>
        <Select id="movement-recurring-rule" value={form.recurringRuleId} onChange={(e) => form.setRecurringRuleId(e.target.value)}>
          <option value="">Elige una regla</option>
          {form.recurringRules.map((rule) => (
            <option key={rule.id} value={rule.id}>
              {rule.name}
            </option>
          ))}
        </Select>
      </FieldShell>
      <AccountSelect
        label="Cuenta"
        value={form.accountOriginId}
        onChange={form.setAccountOriginId}
        accounts={form.accounts}
        allowEmpty
      />
      <FieldShell label="Categoría" htmlFor="movement-category">
        <CategorySelector value={form.category} onChange={form.setCategory} aria-label="Categoría" />
      </FieldShell>
    </>
  );
}
