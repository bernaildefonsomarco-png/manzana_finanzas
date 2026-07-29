"use client";

import { FieldShell, Select } from "@/ui/primitivas/field";

export function AccountSelect({
  label,
  value,
  onChange,
  accounts,
  required,
  allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  accounts: Array<{ id: string; name: string; current_balance: number }>;
  required?: boolean;
  allowEmpty?: boolean;
}) {
  const id = `movement-account-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FieldShell label={label} htmlFor={id} required={required}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty || !required ? <option value="">Sin cuenta</option> : <option value="">Elige una cuenta</option>}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.name} — S/{account.current_balance.toFixed(2)}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}

export function BoxSelect({
  label,
  value,
  onChange,
  boxes,
  allowEmpty,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  boxes: Array<{ id: string; name: string; current_balance: number }>;
  allowEmpty?: boolean;
}) {
  const id = `movement-box-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <FieldShell label={label} htmlFor={id}>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty ? <option value="">Sin caja</option> : null}
        {boxes.map((box) => (
          <option key={box.id} value={box.id}>
            {box.name} — S/{box.current_balance.toFixed(2)}
          </option>
        ))}
      </Select>
    </FieldShell>
  );
}
