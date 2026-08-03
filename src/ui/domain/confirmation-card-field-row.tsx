import { Input, Label, Select } from "@/ui/primitivas/field";
import { MoneyText } from "@/ui/primitivas/money";
import { cn } from "@/ui/primitivas/cn";
import type { ConfirmationCardField } from "./confirmation-card";

export function ConfirmationCardFieldRow({
  field,
  fieldId,
  isEditable,
  onFieldChange,
}: {
  field: ConfirmationCardField;
  fieldId: string;
  isEditable: boolean;
  onFieldChange?: (key: string, value: string) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt>
        <Label htmlFor={fieldId}>{field.label}</Label>
      </dt>
      <dd
        className={cn(
          "text-right",
          field.uncertain && !isEditable
            ? "rounded-sm bg-warning-subtle px-2 py-0.5 text-warning-on-subtle"
            : undefined
        )}
      >
        {isEditable ? (
          field.options ? (
            <Select
              id={fieldId}
              value={field.value}
              onChange={(event) => onFieldChange?.(field.key, event.target.value)}
              aria-invalid={field.uncertain || undefined}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          ) : (
            <Input
              id={fieldId}
              value={field.value}
              onChange={(event) => onFieldChange?.(field.key, event.target.value)}
              aria-invalid={field.uncertain || undefined}
            />
          )
        ) : field.moneyValue !== undefined ? (
          <MoneyText value={field.moneyValue} className="text-sm text-text" />
        ) : (
          <span className="text-sm text-text">{field.value}</span>
        )}
      </dd>
    </div>
  );
}
